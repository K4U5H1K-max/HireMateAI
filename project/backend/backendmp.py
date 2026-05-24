
# ----------------------------------------------------------
#  HireMateAI Backend  —  FINAL WORKING VERSION
# ----------------------------------------------------------

import os
import warnings
import time
import uuid
import tempfile
import shutil
import io
import re
import glob
from pathlib import Path
from typing import List, Dict, Optional, Tuple

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator

import pyttsx3
import speech_recognition as sr

# ----------------------------------------------------------
# GEMINI IMPORT
# ----------------------------------------------------------
try:
    import google.generativeai as genai
except Exception:
    genai = None
try:
    from google.cloud import translate_v2 as translate
except Exception:
    translate = None


def _prepend_path(directory: str) -> None:
    if directory and os.path.isdir(directory):
        current = os.environ.get("PATH", "")
        if directory not in current.split(os.pathsep):
            os.environ["PATH"] = directory + os.pathsep + current


def _find_ffmpeg_candidates() -> List[str]:
    candidates: List[str] = []

    for env_key in ("FFMPEG_PATH", "FFMPEG_BIN"):
        value = os.getenv(env_key)
        if value:
            candidates.append(value)

    legacy = r"C:\ffmpeg\ffmpegfile\bin\ffmpeg.exe"
    if os.path.isfile(legacy):
        candidates.append(legacy)

    winget_pattern = os.path.join(
        os.environ.get("LOCALAPPDATA", ""),
        "Microsoft",
        "WinGet",
        "Packages",
        "Gyan.FFmpeg*",
        "ffmpeg-*-full_build",
        "bin",
        "ffmpeg.exe",
    )
    candidates.extend(glob.glob(winget_pattern))

    on_path = shutil.which("ffmpeg")
    if on_path:
        candidates.append(on_path)

    return candidates


def _find_ffprobe_candidates(ffmpeg_exe: Optional[str]) -> List[str]:
    candidates: List[str] = []

    for env_key in ("FFPROBE_PATH",):
        value = os.getenv(env_key)
        if value:
            candidates.append(value)

    if ffmpeg_exe:
        sibling = os.path.join(os.path.dirname(ffmpeg_exe), "ffprobe.exe")
        candidates.append(sibling)

    legacy = r"C:\ffmpeg\ffmpegfile\bin\ffprobe.exe"
    if os.path.isfile(legacy):
        candidates.append(legacy)

    on_path = shutil.which("ffprobe")
    if on_path:
        candidates.append(on_path)

    return candidates


def resolve_ffmpeg_paths() -> Tuple[Optional[str], Optional[str]]:
    ffmpeg_exe: Optional[str] = None
    for candidate in _find_ffmpeg_candidates():
        if candidate and os.path.isfile(candidate):
            ffmpeg_exe = os.path.abspath(candidate)
            break

    ffprobe_exe: Optional[str] = None
    for candidate in _find_ffprobe_candidates(ffmpeg_exe):
        if candidate and os.path.isfile(candidate):
            ffprobe_exe = os.path.abspath(candidate)
            break

    return ffmpeg_exe, ffprobe_exe


def _load_dotenv_early() -> None:
    project_dir = Path(__file__).resolve().parent
    for env_path in (project_dir / ".env", project_dir.parent / ".env"):
        if not env_path.exists():
            continue
        try:
            for line in env_path.read_text(encoding="utf-8").splitlines():
                stripped = line.strip()
                if not stripped or stripped.startswith("#") or "=" not in stripped:
                    continue
                if stripped.startswith("export "):
                    stripped = stripped[len("export ") :].strip()
                key, value = stripped.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
        except Exception:
            pass


def bootstrap_ffmpeg_for_pydub() -> Tuple[Optional[str], Optional[str]]:
    ffmpeg_exe, ffprobe_exe = resolve_ffmpeg_paths()
    if ffmpeg_exe:
        _prepend_path(os.path.dirname(ffmpeg_exe))
    return ffmpeg_exe, ffprobe_exe


_load_dotenv_early()
FFMPEG_EXE, FFPROBE_EXE = bootstrap_ffmpeg_for_pydub()

from pdfminer.high_level import extract_text
from pydub import AudioSegment

if FFMPEG_EXE:
    AudioSegment.converter = FFMPEG_EXE
    print(f"FFmpeg configured: {FFMPEG_EXE}")
else:
    print("WARNING: FFMPEG NOT FOUND — speech_to_text may fail for WebM/OGG uploads")

if FFPROBE_EXE:
    AudioSegment.ffprobe = FFPROBE_EXE

# ----------------------------------------------------------
# BASIC SETTINGS
# ----------------------------------------------------------
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
warnings.filterwarnings('ignore')

# ----------------------------------------------------------
# GEMINI API KEY (from .env or environment)
# ----------------------------------------------------------
def load_env_file(env_path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}
    if not env_path.exists():
        return values
    try:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if stripped.startswith("export "):
                stripped = stripped[len("export "):].strip()
            if "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key:
                values[key] = value
    except Exception:
        return values
    return values


def _append_unique_key(keys: List[str], seen: set, value: Optional[str]) -> None:
    if value and value not in seen:
        seen.add(value)
        keys.append(value)


def load_gemini_api_keys() -> List[str]:
    keys: List[str] = []
    seen: set = set()
    project_dir = Path(__file__).resolve().parent

    for env_path in (project_dir / ".env", project_dir.parent / ".env"):
        values = load_env_file(env_path)
        _append_unique_key(
            keys, seen,
            values.get("GEMINI_API_KEY") or values.get("GOOGLE_API_KEY"),
        )
        _append_unique_key(
            keys, seen,
            values.get("GEMINI_API_KEY_FALLBACK") or values.get("GOOGLE_API_KEY_FALLBACK"),
        )

    _append_unique_key(keys, seen, os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
    _append_unique_key(
        keys, seen,
        os.getenv("GEMINI_API_KEY_FALLBACK") or os.getenv("GOOGLE_API_KEY_FALLBACK"),
    )
    return keys


GEMINI_API_KEYS = load_gemini_api_keys()
_active_key_index = 0

if genai is not None and GEMINI_API_KEYS:
    try:
        genai.configure(api_key=GEMINI_API_KEYS[0])
        model = genai.GenerativeModel("models/gemini-2.5-flash")
        print("Gemini initialized successfully")
        if len(GEMINI_API_KEYS) > 1:
            print(f"Gemini fallback key configured ({len(GEMINI_API_KEYS)} keys)")
    except Exception as e:
        print("Gemini initialization failed")
        print("ERROR:", str(e))
        model = None
elif genai is None:
    print("google.generativeai package not installed")
    model = None
else:
    print("GEMINI_API_KEY not set — add it to project/.env")
    model = None

# ----------------------------------------------------------
# SPEECH RECOGNIZER
# ----------------------------------------------------------
recognizer = sr.Recognizer()
recognizer.pause_threshold = 1.2

# ----------------------------------------------------------
# FASTAPI
# ----------------------------------------------------------
app = FastAPI(
    title="HireMate AI API",
    version="1.0.0"
)
class TranslationRequest(BaseModel):
    text: str
    target_language: str


class TranslationResponse(BaseModel):
    success: bool
    original_text: str
    translated_text: str
    source_language: str
    target_language: str
    message: str
# ----------------------------------------------------------
# TRANSLATION ENDPOINTS
# ----------------------------------------------------------
def get_target_lang_code(lang_code: str) -> str:
    """Convert language code to Google Translate target language code."""
    lang_map = {
        'en-US': 'en', 'en-GB': 'en',
        'es-ES': 'es', 'fr-FR': 'fr', 'de-DE': 'de', 'it-IT': 'it',
        'pt-BR': 'pt', 'ja-JP': 'ja', 'ko-KR': 'ko',
        'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', 'ru-RU': 'ru',
        'ar-SA': 'ar',
        # Indian languages
        'hi-IN': 'hi', 'ml-IN': 'ml', 'te-IN': 'te', 'mr-IN': 'mr',
        'ur-IN': 'ur', 'bn-IN': 'bn', 'as-IN': 'as', 'or-IN': 'or'
    }
    return lang_map.get(lang_code, 'en')

translation_client = None
try:
    if not translate:
        print("❌ google.cloud.translate_v2 import failed - translation disabled")
    else:
        # Try to use credentials from environment or keyfile
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if credentials_path and os.path.exists(credentials_path):
            try:
                from google.oauth2 import service_account
                credentials = service_account.Credentials.from_service_account_file(
                    credentials_path,
                    scopes=['https://www.googleapis.com/auth/cloud-platform']
                )
                translation_client = translate.Client(credentials=credentials)
                print("✅ Translation client initialized with service account credentials")
            except Exception as e:
                print(f"⚠️  Could not use service account credentials: {e}")
                try:
                    translation_client = translate.Client()
                    print("✅ Translation client initialized with application default credentials")
                except Exception as e2:
                    print(f"❌ Translation client fallback failed: {e2}")
                    translation_client = None
        else:
            try:
                translation_client = translate.Client()
                print("✅ Translation client initialized (using default credentials)")
            except Exception as e:
                print(f"❌ Translation client initialization failed: {e}")
                translation_client = None
except Exception as e:
    print(f"❌ Unexpected error during translation client setup: {e}")
    translation_client = None

@app.post("/translate", response_model=TranslationResponse)
async def translate_text(req: TranslationRequest):
    """
    Translate text from English to target language (or vice versa).
    
    target_language: Language code (e.g., 'hi-IN', 'ml-IN', etc.)
    """
    if not translation_client:
        return TranslationResponse(
            success=False,
            original_text=req.text,
            translated_text=req.text,
            source_language="en",
            target_language=req.target_language,
            message="Translation service not available"
        )

    try:
        target_lang = get_target_lang_code(req.target_language)
        
        # Translate English to target language using google-cloud-translate v2 API
        result = translation_client.translate(
            req.text,
            source_language='en',
            target_language=target_lang
        )
        
        # Result is a dictionary with 'translatedText' and other fields
        translated = result.get('translatedText', req.text) if result else req.text
        
        return TranslationResponse(
            success=True,
            original_text=req.text,
            translated_text=translated,
            source_language="en",
            target_language=req.target_language,
            message="Translation successful"
        )
    except Exception as e:
        print(f"Translation error: {e}")
        return TranslationResponse(
            success=False,
            original_text=req.text,
            translated_text=req.text,
            source_language="en",
            target_language=req.target_language,
            message=f"Translation failed: {str(e)}"
        )


@app.post("/translate-to-english", response_model=TranslationResponse)
async def translate_to_english(req: TranslationRequest):
    """
    Translate text from target language back to English.
    
    target_language: Original language code (e.g., 'hi-IN', 'ml-IN', etc.)
    """
    if not translation_client:
        return TranslationResponse(
            success=False,
            original_text=req.text,
            translated_text=req.text,
            source_language=req.target_language,
            target_language="en",
            message="Translation service not available"
        )

    try:
        source_lang = get_target_lang_code(req.target_language)
        
        # Translate from target language back to English using google-cloud-translate v2 API
        result = translation_client.translate(
            req.text,
            source_language=source_lang,
            target_language='en'
        )
        
        # Result is a dictionary with 'translatedText' and other fields
        translated = result.get('translatedText', req.text) if result else req.text
        
        return TranslationResponse(
            success=True,
            original_text=req.text,
            translated_text=translated,
            source_language=req.target_language,
            target_language="en",
            message="Translation successful"
        )
    except Exception as e:
        print(f"Translation error: {e}")
        return TranslationResponse(
            success=False,
            original_text=req.text,
            translated_text=req.text,
            source_language=req.target_language,
            target_language="en",
            message=f"Translation failed: {str(e)}"
        )



def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_allowed_origins() -> List[str]:
    raw_value = os.getenv("ALLOWED_ORIGINS", _DEFAULT_CORS)
    raw_items = [origin.strip() for origin in raw_value.split(",") if origin.strip()]
    if "*" in raw_items:
        return ["*"]
    return raw_items


_DEFAULT_CORS = (
    "http://localhost:5173,http://localhost:5174,"
    "http://127.0.0.1:5173,http://127.0.0.1:5174"
)
ALLOWED_ORIGINS = _parse_allowed_origins()
ALLOW_CREDENTIALS = "*" not in ALLOWED_ORIGINS
TTS_ENABLED = _env_flag("ENABLE_TTS", default=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

QUESTIONS_STORE: Dict[str, Dict] = {}

# ----------------------------------------------------------
# HELPERS
# ----------------------------------------------------------
def ensure_model_ready():
    if model is None:
        raise HTTPException(
            status_code=500,
            detail="Gemini model not initialized"
        )
    return True


def get_gemini_text(response) -> str:
    try:
        return (response.text or "").strip()
    except Exception:
        try:
            parts = response.candidates[0].content.parts
            return "".join(getattr(part, "text", "") or "" for part in parts).strip()
        except Exception:
            return ""


def _is_quota_or_limit_error(exc: Exception) -> bool:
    name = type(exc).__name__.lower()
    if "resourceexhausted" in name or "toomanyrequests" in name:
        return True
    msg = str(exc).lower()
    markers = (
        "quota", "rate limit", "rate_limit", "429", "billing",
        "exceeded", "credit", "resource has been exhausted", "limit",
    )
    return any(marker in msg for marker in markers)


def _model_for_key_index(key_index: int):
    genai.configure(api_key=GEMINI_API_KEYS[key_index])
    return genai.GenerativeModel("models/gemini-2.5-flash")


def call_gemini(prompt: str) -> Optional[str]:
    global model, _active_key_index

    if genai is None or not GEMINI_API_KEYS:
        return None

    for attempt in range(len(GEMINI_API_KEYS)):
        key_index = (_active_key_index + attempt) % len(GEMINI_API_KEYS)
        try:
            if attempt > 0:
                model = _model_for_key_index(key_index)
            elif model is None:
                model = _model_for_key_index(key_index)

            response = model.generate_content(prompt)
            text = get_gemini_text(response)
            if text:
                if key_index != _active_key_index:
                    _active_key_index = key_index
                    print(f"Switched to Gemini API key #{key_index + 1}")
                return text
        except Exception as e:
            if _is_quota_or_limit_error(e) and attempt < len(GEMINI_API_KEYS) - 1:
                print(
                    f"Gemini key #{key_index + 1} hit quota/credit limit, "
                    "trying fallback key..."
                )
                model = None
                continue
            print("Gemini call failed:", e)
            return None

    return None


def extract_resume_text_from_file(file_path: str) -> Optional[str]:
    try:
        if file_path.endswith(".pdf"):
            return extract_text(file_path)

        elif file_path.endswith(".txt"):
            try:
                return open(file_path, "r", encoding="utf-8").read()

            except Exception:
                with open(file_path, "rb") as f:
                    raw = f.read()

                if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
                    return raw.decode("utf-16", errors="ignore")

                return raw.decode("utf-8", errors="ignore")

    except Exception as e:
        print("Resume extraction error:", e)
        return None

    return None


def _clean_evaluation_text(value: str) -> str:
    cleaned = (value or "").strip()
    cleaned = re.sub(r"\*\*", "", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def parse_scores_from_text(text: str):

    out = {
        "technical": None,
        "communication": None,
        "role_fit": None,
        "presence": None,
        "final": None,
        "feedback": None,
        "nonverbal_feedback": None,
    }

    if not text:
        return out

    try:
        m = re.search(r"Technical\s+Score[:\-]?\s*(\d+(?:\.\d+)?)", text, re.I)
        if m:
            out["technical"] = float(m.group(1))

        m = re.search(r"Communication\s+Score[:\-]?\s*(\d+(?:\.\d+)?)", text, re.I)
        if m:
            out["communication"] = float(m.group(1))

        m = re.search(r"Role[- ]?fit\s+Score[:\-]?\s*(\d+(?:\.\d+)?)", text, re.I)
        if m:
            out["role_fit"] = float(m.group(1))

        m = re.search(r"Presence\s+Score[:\-]?\s*(\d+(?:\.\d+)?)", text, re.I)
        if m:
            out["presence"] = float(m.group(1))

        m = re.search(r"(?:Final|Overall)\s+Score[:\-]?\s*(\d+(?:\.\d+)?)", text, re.I)
        if m:
            out["final"] = float(m.group(1))

        nv = re.search(
            r"(?:Nonverbal\s+Feedback|Body\s+Language(?:\s+Feedback)?)"
            r"[:\-]?\s*(.+)$",
            text,
            re.I | re.S,
        )
        if nv:
            out["nonverbal_feedback"] = _clean_evaluation_text(nv.group(1))
            verbal_source = text[: nv.start()]
        else:
            verbal_source = text

        vf = re.search(
            r"(?<!Nonverbal\s)(?<!Body\s)Feedback[:\-]?\s*(.+?)"
            r"(?=\n\s*(?:Nonverbal\s+Feedback|Body\s+Language|Technical\s+Score|"
            r"Communication\s+Score|Role[- ]?fit\s+Score|Presence\s+Score|"
            r"Final\s+Score|Overall\s+Score)|\Z)",
            verbal_source,
            re.I | re.S,
        )
        if vf:
            out["feedback"] = _clean_evaluation_text(vf.group(1))

    except Exception as e:
        print("Score parsing error:", e)

    return out


def simple_summary(text: str, max_sentences: int = 2):

    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    sentences = [s for s in sentences if s]

    if not sentences:
        return text[:200]

    return " ".join(sentences[:max_sentences])


def parse_questions_from_text(text: str) -> List[str]:
    raw = text.split("\n")
    return [
        re.sub(r"^\d+[\.\)]\s*", "", q).strip()
        for q in raw
        if q.strip()
    ]


def fallback_interview_questions(
    company: str,
    role: str,
    num: int
) -> List[str]:

    pool = [
        f"Tell me about yourself and why you want the {role} role at {company}.",
        f"What experience do you have that is most relevant to this {role} position?",
        f"Describe a technical challenge you solved and the outcome.",
        f"How do you stay current with technologies used in {role} work?",
        f"Tell me about a team project you contributed to and your specific role.",
        f"What are your strongest skills for this {role} role?",
        f"Describe a time you had to deliver under a tight deadline.",
        f"How do you handle constructive feedback on your work?",
        f"Walk me through a project from your background that fits this role.",
        f"How would you approach your first 30 days as a {role} at {company}?",
        f"Describe a time you had to learn something new quickly for work.",
        f"What outcomes or metrics do you use to measure success?",
        f"How do you prioritize when handling multiple responsibilities?",
        f"Tell me about a mistake you made and what you learned from it.",
        f"Why should {company} hire you for this {role} position?",
    ]

    return pool[:max(1, min(num, len(pool)))]


def simple_resume_evaluation(text: str, role: str):
    """
    Fallback keyword-based evaluation when LLM is unavailable.
    """
    keywords = [
        "python",
        "java",
        "react",
        "node",
        "docker",
        "aws",
        "sql",
        "tensorflow",
        "pytorch",
        "machine learning",
        "ml",
    ]

    lowered = text.lower()

    matches = [
        keyword
        for keyword in keywords
        if keyword in lowered
    ]

    technical_score = min(10.0, 3.0 + len(matches) * 1.2)
    communication_score = 6.0 if len(text.split()) > 120 else 5.0
    experience_score = 5.0 + (len(matches) * 0.5)

    feedback = (
        f"Technical Score: {technical_score:.1f}/10\n"
        f"Communication Score: {communication_score:.1f}/10\n"
        f"Experience Score: {experience_score:.1f}/10\n"
        f"Recommendation: Resume appears relevant for {role}."
    )

    return feedback, technical_score, communication_score, experience_score


def parse_resume_scores(evaluation_text: str) -> tuple:
    """
    Parse LLM evaluation text to extract scores.
    Returns: (evaluation_text, tech_score, comm_score, exp_score, overall_score)
    """
    import re
    
    technical_score = None
    communication_score = None
    experience_score = None
    overall_score = None
    role_fit_score = None
    
    try:
        # Extract Technical Score
        tech_match = re.search(r'Technical\s+Score[:\s]+([0-9.]+)', evaluation_text, re.IGNORECASE)
        if tech_match:
            technical_score = float(tech_match.group(1))
        
        # Extract Communication Score
        comm_match = re.search(r'Communication\s+Score[:\s]+([0-9.]+)', evaluation_text, re.IGNORECASE)
        if comm_match:
            communication_score = float(comm_match.group(1))
        
        # Extract Experience Score
        exp_match = re.search(r'Experience\s+Score[:\s]+([0-9.]+)', evaluation_text, re.IGNORECASE)
        if exp_match:
            experience_score = float(exp_match.group(1))
        
        # Extract Overall/Final Score
        overall_match = re.search(r'Overall\s+Score[:\s]+([0-9.]+)', evaluation_text, re.IGNORECASE)
        if overall_match:
            overall_score = float(overall_match.group(1))
        
        # Extract Role Fit Score
        fit_match = re.search(r'Role\s+Fit\s+Score[:\s]+([0-9.]+)', evaluation_text, re.IGNORECASE)
        if fit_match:
            role_fit_score = float(fit_match.group(1))
    except Exception as e:
        print(f"Error parsing scores: {e}")
    
    return technical_score, communication_score, experience_score, role_fit_score, overall_score


def evaluate_resume_with_llm(text: str, role: str) -> tuple:
    """
    Use LLM to evaluate resume with structured scoring.
    Returns: (evaluation_text, tech_score, comm_score, exp_score, overall_score)
    """
    prompt = f"""You are a professional resume evaluator for the role of {role}.

Please evaluate this resume and provide structured scores:

Resume:
{text[:3500]}

Provide your evaluation in this exact format:
Technical Score: X/10
Communication Score: X/10
Experience Score: X/10
Role Fit Score: X/10
Overall Score: X/10

Followed by:
Key Strengths: [2-3 bullet points]
Areas for Improvement: [2-3 bullet points]
Recommendation: [1-2 sentences]
"""
    
    evaluation_text = call_gemini(prompt)
    if not evaluation_text:
        return None, None, None, None, None
    
    tech_score, comm_score, exp_score, fit_score, overall_score = parse_resume_scores(evaluation_text)
    return evaluation_text, tech_score, comm_score, exp_score, overall_score

# ----------------------------------------------------------
# RESPONSE MODELS
# ----------------------------------------------------------
class ResumeEvaluationResponse(BaseModel):
    success: bool
    resume_text: Optional[str] = None
    resume_summary: str
    evaluation: str
    technical_score: Optional[float] = None
    communication_score: Optional[float] = None
    experience_score: Optional[float] = None
    role_fit_score: Optional[float] = None
    overall_score: Optional[float] = None
    message: str


class QuestionGenerationRequest(BaseModel):
    company: str
    role: str
    resume_summary: str
    num_questions: int


class QuestionGenerationResponse(BaseModel):
    success: bool
    session_id: str
    questions: List[str]
    message: str


class NonverbalMetrics(BaseModel):
    duration_sec: int = 0
    smile_pct: int = 0
    nod_count: int = 0
    gaze_away_pct: int = 0
    lean_forward_pct: int = 0
    lean_back_pct: int = 0
    engagement_score: int = 50

    @field_validator(
        "duration_sec",
        "smile_pct",
        "nod_count",
        "gaze_away_pct",
        "lean_forward_pct",
        "lean_back_pct",
        "engagement_score",
        mode="before",
    )
    @classmethod
    def _coerce_int(cls, value):
        if value is None:
            return 0
        if isinstance(value, bool):
            return int(value)
        try:
            return int(round(float(value)))
        except (TypeError, ValueError):
            return 0


class QAPair(BaseModel):
    question: str
    answer: str
    nonverbal: Optional[NonverbalMetrics] = None


class InterviewEvaluationRequest(BaseModel):
    qa_list: List[QAPair]
    role: str
    resume_summary: str = ""
    is_video_interview: bool = False


class InterviewEvaluationResponse(BaseModel):
    success: bool
    technical_score: Optional[float]
    communication_score: Optional[float]
    role_fit_score: Optional[float]
    presence_score: Optional[float]
    final_score: Optional[float]
    feedback: Optional[str]
    nonverbal_feedback: Optional[str]
    raw_evaluation: Optional[str]
    message: str


class TextToSpeechRequest(BaseModel):
    text: str
    rate: Optional[int] = 150


class SpeechToTextResponse(BaseModel):
    success: bool
    transcription: str
    message: str


def build_nonverbal_summary(qa_list: List[QAPair]) -> str:
    lines = []
    for i, qa in enumerate(qa_list):
        nv = qa.nonverbal
        if not nv:
            continue
        lines.append(
            f"Q{i + 1}: smile {nv.smile_pct}%, nods {nv.nod_count}, "
            f"gaze away {nv.gaze_away_pct}%, lean forward {nv.lean_forward_pct}%, "
            f"lean back {nv.lean_back_pct}%, engagement {nv.engagement_score}/100, "
            f"duration {nv.duration_sec}s"
        )
    return "\n".join(lines)


def offline_nonverbal_feedback(qa_list: List[QAPair], role: str) -> tuple:
    metrics = [qa.nonverbal for qa in qa_list if qa.nonverbal]
    if not metrics:
        return None, None

    avg_engagement = sum(m.engagement_score for m in metrics) / len(metrics)
    avg_gaze_away = sum(m.gaze_away_pct for m in metrics) / len(metrics)
    avg_smile = sum(m.smile_pct for m in metrics) / len(metrics)
    total_nods = sum(m.nod_count for m in metrics)
    avg_lean_back = sum(m.lean_back_pct for m in metrics) / len(metrics)
    avg_lean_forward = sum(m.lean_forward_pct for m in metrics) / len(metrics)

    presence = max(1.0, min(10.0, round(avg_engagement / 10, 1)))

    feedback_parts = [
        f"From an interviewer's perspective for the {role} role, your on-camera presence scored {presence}/10.",
    ]
    if avg_smile >= 15:
        feedback_parts.append(
            "Frequent smiles came across as approachable and helped build rapport."
        )
    elif avg_smile < 5:
        feedback_parts.append(
            "Limited facial warmth may have made answers feel more serious than intended; a natural smile when greeting or agreeing can help."
        )

    if avg_gaze_away >= 25:
        feedback_parts.append(
            f"You looked away from the camera about {avg_gaze_away:.0f}% of the time, which can read as distraction or low confidence to interviewers."
        )
    else:
        feedback_parts.append(
            "Eye contact with the camera was generally steady, which supports trust and attentiveness."
        )

    if total_nods >= 2:
        feedback_parts.append(
            f"Nodding ({total_nods} detected) signaled active listening and agreement."
        )

    if avg_lean_forward >= 20:
        feedback_parts.append(
            "Leaning toward the camera suggested engagement and interest in the conversation."
        )
    if avg_lean_back >= 20:
        feedback_parts.append(
            "Leaning back or away from the camera at times may have reduced perceived energy; staying centered reads as more confident."
        )

    return presence, " ".join(feedback_parts)

# ----------------------------------------------------------
# ROOT
# ----------------------------------------------------------
@app.get("/")
async def root():
    return {
        "message": "HireMate AI API is running"
    }

# ----------------------------------------------------------
# SPEECH TO TEXT
# ----------------------------------------------------------
@app.post(
    "/speech_to_text",
    response_model=SpeechToTextResponse
)
async def speech_to_text(
    audio_file: UploadFile = File(...),
    language: str = Form(default="en-US")
):

    tmp_in = None
    tmp_wav = None

    try:
        ext = os.path.splitext(audio_file.filename)[1].lower()

        if ext not in [
            ".webm",
            ".ogg",
            ".mp3",
            ".wav",
            ".m4a"
        ]:
            ext = ".webm"

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=ext
        ) as tmp:

            shutil.copyfileobj(audio_file.file, tmp)
            tmp_in = tmp.name

        audio = AudioSegment.from_file(tmp_in)

        audio = audio.set_channels(1).set_frame_rate(16000)

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".wav"
        ) as tmp2:

            tmp_wav = tmp2.name

            audio.export(
                tmp_wav,
                format="wav"
            )

        with sr.AudioFile(tmp_wav) as source:

            recognizer.adjust_for_ambient_noise(
                source,
                duration=0.3
            )

            audio_data = recognizer.record(source)

        text = recognizer.recognize_google(audio_data, language=language)

        return SpeechToTextResponse(
            success=True,
            transcription=text,
            message="OK"
        )

    except sr.UnknownValueError:

        return SpeechToTextResponse(
            success=False,
            transcription="",
            message="Could not understand audio"
        )

    except Exception as e:

        return SpeechToTextResponse(
            success=False,
            transcription="",
            message=str(e)
        )

    finally:

        if tmp_in and os.path.exists(tmp_in):
            os.unlink(tmp_in)

        if tmp_wav and os.path.exists(tmp_wav):
            os.unlink(tmp_wav)

# ----------------------------------------------------------
# TEXT TO SPEECH
# ----------------------------------------------------------
@app.post("/tts")
async def text_to_speech(
    tts_req: TextToSpeechRequest
):
    if not TTS_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="TTS is disabled on this deployment"
        )

    tmp_path = None

    try:
        engine = pyttsx3.init()

        engine.setProperty(
            "rate",
            tts_req.rate
        )

        tmp = tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".wav"
        )

        tmp_path = tmp.name
        tmp.close()

        engine.save_to_file(
            tts_req.text,
            tmp_path
        )

        engine.runAndWait()
        engine.stop()

        with open(tmp_path, "rb") as audio_file:
            audio = audio_file.read()

        return StreamingResponse(
            io.BytesIO(audio),
            media_type="audio/wav"
        )

    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"TTS engine unavailable: {e}"
        )

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

# ----------------------------------------------------------
# RESUME UPLOAD
# ----------------------------------------------------------
@app.post(
    "/upload_resume",
    response_model=ResumeEvaluationResponse
)
async def upload_resume(
    file: UploadFile = File(...),
    role: str = Form(...)
):

    tmp_path = None

    try:
        filename = (file.filename or "resume.txt").lower()
        suffix = ".pdf" if filename.endswith(".pdf") else ".txt"

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as tmp:

            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        text = extract_resume_text_from_file(tmp_path)

        if not text:

            return ResumeEvaluationResponse(
                success=False,
                resume_summary="N/A",
                evaluation="N/A",
                message="Resume unreadable"
            )

        # Generate summary
        summary = call_gemini(
            f"""Summarize this resume in 2 concise sentences:

            {text[:2000]}
            """
        )
        if not summary:
            summary = simple_summary(text)

        # Evaluate resume with LLM
        evaluation_text, technical_score, communication_score, experience_score, overall_score = evaluate_resume_with_llm(text, role)

        # Fallback to keyword-based evaluation if LLM fails
        if not evaluation_text:
            evaluation_text, technical_score, communication_score, experience_score = simple_resume_evaluation(text, role)
            overall_score = (technical_score + communication_score + experience_score) / 3 if all([technical_score, communication_score, experience_score]) else None
            message = "Resume evaluated using offline scoring (Gemini unavailable)"
        else:
            message = "Resume evaluated successfully with LLM"

        return ResumeEvaluationResponse(
            success=True,
            resume_text=text[:1000],
            resume_summary=summary,
            evaluation=evaluation_text,
            technical_score=technical_score,
            communication_score=communication_score,
            experience_score=experience_score,
            overall_score=overall_score,
            message=message
        )

    except HTTPException:
        raise
    except Exception as e:
        print("upload_resume error:", e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze resume: {e}"
        )
    finally:

        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

# ----------------------------------------------------------
# GENERATE QUESTIONS
# ----------------------------------------------------------
@app.post(
    "/generate_questions",
    response_model=QuestionGenerationResponse
)
async def generate_questions(
    request: QuestionGenerationRequest
):

    num = max(1, min(15, request.num_questions))

    gemini_text = call_gemini(
        f"""
        Generate {num} interview questions.

        Company: {request.company}
        Role: {request.role}

        Resume Summary:
        {request.resume_summary}

        Give only numbered questions.
        """
    )

    questions = parse_questions_from_text(gemini_text) if gemini_text else []
    used_fallback = not questions

    if used_fallback:
        questions = fallback_interview_questions(
            request.company,
            request.role,
            num
        )

    session_id = str(uuid.uuid4())

    QUESTIONS_STORE[session_id] = {
        "questions": questions,
        "created": time.time()
    }

    message = "Questions generated"
    if used_fallback:
        message = (
            "Questions generated using offline fallback "
            "(Gemini quota unavailable or API error)"
        )

    return QuestionGenerationResponse(
        success=True,
        session_id=session_id,
        questions=questions,
        message=message
    )

# ----------------------------------------------------------
# GET QUESTIONS
# ----------------------------------------------------------
@app.get("/questions/{session_id}")
async def get_questions(session_id: str):

    data = QUESTIONS_STORE.get(session_id)

    if not data:
        raise HTTPException(
            status_code=404,
            detail="Session expired"
        )

    return {
        "success": True,
        "questions": data["questions"]
    }

# ----------------------------------------------------------
# INTERVIEW EVALUATION
# ----------------------------------------------------------
@app.post(
    "/evaluate_interview",
    response_model=InterviewEvaluationResponse
)
async def evaluate_interview(
    req: InterviewEvaluationRequest
):

    qa_text = "\n".join([
        f"Q: {q.question}\nA: {q.answer}\n"
        for q in req.qa_list
    ])

    nonverbal_block = build_nonverbal_summary(req.qa_list)
    has_nonverbal = bool(nonverbal_block.strip())
    video_mode = req.is_video_interview or has_nonverbal

    nonverbal_prompt = ""
    if video_mode and nonverbal_block:
        nonverbal_prompt = f"""
        Video interview body-language metrics (per question):
        {nonverbal_block}

        Include a separate section explaining how these physical cues would affect an interviewer's impression
        (confidence, engagement, trust, professionalism). Note smiles, nodding, eye contact, leaning forward/back,
        and moving away from the camera.
        """

    evaluation_text = call_gemini(
        f"""
        Evaluate this interview.

        Role:
        {req.role}

        Resume Summary:
        {req.resume_summary}

        Interview Transcript:
        {qa_text}
        {nonverbal_prompt}

        Use EXACTLY this format (scores first, then two separate feedback blocks):

        Technical Score: X/10
        Communication Score: X/10
        Role-fit Score: X/10
        {"Presence Score: X/10" if video_mode else ""}
        Final Score: X/10

        Feedback:
        (4 sentences ONLY about verbal answer quality — do not mention body language here)

        {"Nonverbal Feedback:" if video_mode else ""}
        {"(4-6 sentences ONLY about body language, eye contact, smiles, posture, and how an interviewer would perceive the candidate — do not repeat verbal feedback)" if video_mode else ""}
        """
    )

    used_fallback = not evaluation_text
    presence_score = None
    nonverbal_feedback = None

    if has_nonverbal:
        presence_score, nonverbal_feedback = offline_nonverbal_feedback(
            req.qa_list, req.role
        )

    if used_fallback:
        answer_count = len(req.qa_list)
        avg_len = (
            sum(len(q.answer.split()) for q in req.qa_list) / answer_count
            if answer_count
            else 0
        )
        technical = min(10.0, 4.0 + avg_len / 15)
        communication = min(10.0, 4.0 + avg_len / 20)
        role_fit = round((technical + communication) / 2, 1)
        if presence_score is not None:
            final = round(
                (technical + communication + role_fit + presence_score) / 4, 1
            )
        else:
            final = round((technical + communication + role_fit) / 3, 1)
        feedback = (
            f"Solid effort for the {req.role} role. "
            f"You answered {answer_count} question(s) with reasonable detail. "
            "Practice structuring answers with situation, action, and result. "
            "Offline scoring used because Gemini quota is unavailable."
        )
        parsed = {
            "technical": technical,
            "communication": communication,
            "role_fit": role_fit,
            "presence": presence_score,
            "final": final,
            "feedback": feedback,
            "nonverbal_feedback": nonverbal_feedback,
        }
        raw_evaluation = feedback
        if nonverbal_feedback:
            raw_evaluation = f"{feedback}\n\nNonverbal Feedback:\n{nonverbal_feedback}"
    else:
        parsed = parse_scores_from_text(evaluation_text)
        if parsed.get("presence") is None and presence_score is not None:
            parsed["presence"] = presence_score
        if not parsed.get("nonverbal_feedback") and nonverbal_feedback:
            parsed["nonverbal_feedback"] = _clean_evaluation_text(nonverbal_feedback)
        if parsed.get("feedback"):
            parsed["feedback"] = _clean_evaluation_text(parsed["feedback"])
        if parsed.get("nonverbal_feedback"):
            parsed["nonverbal_feedback"] = _clean_evaluation_text(
                parsed["nonverbal_feedback"]
            )
        # Avoid showing the same text three times on the results page
        raw_evaluation = None
        if not parsed.get("feedback") and not parsed.get("nonverbal_feedback"):
            raw_evaluation = _clean_evaluation_text(evaluation_text)

    final = parsed["final"]

    score_keys = ["technical", "communication", "role_fit"]
    if parsed.get("presence") is not None:
        score_keys.append("presence")

    if final is None and all(parsed.get(x) for x in score_keys):
        final = round(sum(parsed[x] for x in score_keys) / len(score_keys), 2)

    message = "Interview evaluation completed"
    if used_fallback:
        message = (
            "Interview evaluation completed using offline fallback "
            "(Gemini quota unavailable or API error)"
        )

    return InterviewEvaluationResponse(
        success=True,
        technical_score=parsed.get("technical"),
        communication_score=parsed.get("communication"),
        role_fit_score=parsed.get("role_fit"),
        presence_score=parsed.get("presence"),
        final_score=final,
        feedback=parsed.get("feedback"),
        nonverbal_feedback=parsed.get("nonverbal_feedback"),
        raw_evaluation=raw_evaluation,
        message=message
    )

# ----------------------------------------------------------
# RUN SERVER
# ----------------------------------------------------------
def _port_in_use(port: int) -> bool:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex(("127.0.0.1", port)) == 0


if __name__ == "__main__":

    import sys
    import uvicorn

    port = int(os.getenv("PORT", "8000"))

    if _port_in_use(port):
        print(f"\nPort {port} is already in use — backend is likely already running.")
        print(f"  Open: http://localhost:{port}/docs")
        print("  To restart, stop the other process first:")
        print("    Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess")
        print("    Stop-Process -Id <PID> -Force")
        sys.exit(1)

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port
    )