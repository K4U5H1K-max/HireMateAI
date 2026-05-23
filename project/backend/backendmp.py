# ----------------------------------------------------------
#  HireMateAI Backend  —  FINAL STABLE VERSION
# ----------------------------------------------------------
'''
import os
import warnings
import time
import uuid
import tempfile
import shutil
import io
import re
import traceback
from pathlib import Path
from typing import List, Dict, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

# Firebase admin (optional) for server-side writes to employer Firestore
try:
    import firebase_admin
    from firebase_admin import credentials as fb_credentials
    from firebase_admin import firestore as admin_firestore
    from firebase_admin import auth as fb_auth
except Exception:
    firebase_admin = None
    fb_credentials = None
    admin_firestore = None
    fb_auth = None

import pyttsx3
import speech_recognition as sr

# Optional: Gemini
try:
    import google.generativeai as genai
except Exception:
    genai = None

from pdfminer.high_level import extract_text
from pydub import AudioSegment
from pydub.utils import which

# ----------------------------------------------------------
# FFMPEG — FIXED & STABLE
# ----------------------------------------------------------
FFMPEG_EXE = r"C:\ffmpeg\ffmpegfile\bin\ffmpeg.exe"
FFPROBE_EXE = r"C:\ffmpeg\ffmpegfile\bin\ffprobe.exe"

# Converter
if os.path.exists(FFMPEG_EXE):
    AudioSegment.converter = FFMPEG_EXE
else:
    fallback = which("ffmpeg")
    if fallback:
        AudioSegment.converter = fallback
    else:
        print("❌ FFMPEG NOT FOUND. Audio conversion will fail.")

# Probe
if os.path.exists(FFPROBE_EXE):
    AudioSegment.ffprobe = FFPROBE_EXE

# ----------------------------------------------------------
# BASIC
# ----------------------------------------------------------
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
warnings.filterwarnings('ignore')

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


def load_api_key_from_env_files() -> Optional[str]:
    project_dir = Path(__file__).resolve().parent
    candidate_files = [project_dir / ".env", project_dir.parent / ".env"]

    for env_path in candidate_files:
        values = load_env_file(env_path)
        api_key = values.get("GEMINI_API_KEY") or values.get("GOOGLE_API_KEY")
        if api_key:
            os.environ.setdefault("GEMINI_API_KEY", api_key)
            os.environ.setdefault("GOOGLE_API_KEY", api_key)
            return api_key

    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


GEMINI_API_KEY = load_api_key_from_env_files()
if GEMINI_API_KEY and genai:
    genai.configure(api_key=GEMINI_API_KEY)

try:
    model = genai.GenerativeModel("models/gemini-2.5-flash") if genai else None
except:
    model = None

recognizer = sr.Recognizer()
recognizer.pause_threshold = 1.2

# ----------------------------------------------------------
# FASTAPI
# ----------------------------------------------------------
app = FastAPI(title="HireMate AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

QUESTIONS_STORE: Dict[str, Dict] = {}
QUESTIONS_TTL_SECONDS = 3600

# Initialize Firebase Admin if service account provided
_ADMIN_INIT_DONE = False
_ADMIN_DB = None

def init_firebase_admin():
    global _ADMIN_INIT_DONE, _ADMIN_DB
    if _ADMIN_INIT_DONE:
        return
    if not firebase_admin:
        return

    sa_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')
    sa_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

    try:
        if sa_json:
            import json
            cred_dict = json.loads(sa_json)
            cred = fb_credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
        elif sa_path and os.path.exists(sa_path):
            cred = fb_credentials.Certificate(sa_path)
            firebase_admin.initialize_app(cred)
        else:
            # no credentials provided; skip admin init
            return

        _ADMIN_DB = admin_firestore.client()
        _ADMIN_INIT_DONE = True
    except Exception as e:
        print('Failed to initialize firebase admin:', e)
        _ADMIN_INIT_DONE = False


# ----------------------------------------------------------
# HELPERS
# ----------------------------------------------------------
def ensure_model_ready():
    if model is None:
        raise HTTPException(status_code=500, detail="Model not initialized")
    return True


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
    except:
        return None
    return None


def parse_scores_from_text(text: str):
    out = {"technical": None, "communication": None, "role_fit": None, "final": None, "feedback": None}
    try:
        m = re.search(r"Technical.*?(\d+(?:\.\d+)?)", text, re.I)
        if m: out["technical"] = float(m.group(1))

        m = re.search(r"Communication.*?(\d+(?:\.\d+)?)", text, re.I)
        if m: out["communication"] = float(m.group(1))

        m = re.search(r"(Role[- ]?fit).*?(\d+(?:\.\d+)?)", text, re.I)
        if m: out["role_fit"] = float(m.group(2))

        m = re.search(r"(Final|Overall).*?(\d+(?:\.\d+)?)", text, re.I)
        if m: out["final"] = float(m.group(2))

        m = re.search(r"(Feedback|Recommendation)[:\-]?\s*(.+)", text, re.I | re.S)
        if m: out["feedback"] = m.group(2).strip()
    except:
        pass
    return out


def simple_summary(text: str, max_sentences: int = 2) -> str:
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    sentences = [s for s in sentences if s]
    if not sentences:
        return text[:200].strip()
    return " ".join(sentences[:max_sentences]).strip()


def simple_resume_evaluation(text: str, role: str) -> str:
    keywords = [
        "python", "java", "react", "node", "docker", "aws",
        "sql", "tensorflow", "pytorch", "machine learning", "ml",
    ]
    lowered = text.lower()
    matches = [keyword for keyword in keywords if keyword in lowered]
    technical_score = min(10.0, 3.0 + len(matches) * 1.2)
    communication_score = 6.0 if len(text.split()) > 120 else 5.0
    feedback = (
        f"Technical Score: {technical_score:.1f}/10\n"
        f"Communication Score: {communication_score:.1f}/10\n"
        f"Recommendation: Resume appears relevant for {role}."
    )
    return feedback


# ----------------------------------------------------------
# MODELS
# ----------------------------------------------------------
class ResumeEvaluationResponse(BaseModel):
    success: bool
    resume_text: Optional[str] = None
    resume_summary: str
    evaluation: str
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


class QAPair(BaseModel):
    question: str
    answer: str


class InterviewEvaluationRequest(BaseModel):
    qa_list: List[QAPair]
    role: str
    resume_summary: str


class InterviewEvaluationResponse(BaseModel):
    success: bool
    technical_score: Optional[float]
    communication_score: Optional[float]
    role_fit_score: Optional[float]
    final_score: Optional[float]
    feedback: Optional[str]
    raw_evaluation: Optional[str]
    message: str


class ApplicationRequest(BaseModel):
    jobId: str
    candidateId: str
    candidateEmail: Optional[str] = None
    candidateName: Optional[str] = None
    role: Optional[str] = None
    resumeSummary: Optional[str] = None
    qaList: Optional[List[QAPair]] = None
    evaluation: Optional[dict] = None



class TextToSpeechRequest(BaseModel):
    text: str
    rate: Optional[int] = 150


class SpeechToTextResponse(BaseModel):
    success: bool
    transcription: str
    message: str


# ----------------------------------------------------------
# ROOT
# ----------------------------------------------------------
@app.get("/")
async def root():
    return {"message": "HireMate AI API is running"}


# ----------------------------------------------------------
# SPEECH TO TEXT — *FULLY FIXED*
# ----------------------------------------------------------
@app.post("/speech_to_text", response_model=SpeechToTextResponse)
async def speech_to_text(audio_file: UploadFile = File(...)):
    """
    FIXED:
    - Always converts to WAV PCM 16k Mono
    - Works with .webm from your React MediaRecorder
    - Stable Google SpeechRecognizer transcription
    """

    tmp_in = None
    tmp_wav = None

    try:
        # Save uploaded file
        ext = os.path.splitext(audio_file.filename)[1].lower()
        if ext not in [".webm", ".ogg", ".mp3", ".wav", ".m4a"]:
            ext = ".webm"

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            shutil.copyfileobj(audio_file.file, tmp)
            tmp_in = tmp.name

        # Convert to WAV 16k mono
        audio = AudioSegment.from_file(tmp_in)
        audio = audio.set_channels(1).set_frame_rate(16000)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp2:
            tmp_wav = tmp2.name
            audio.export(tmp_wav, format="wav")

        # Transcribe
        with sr.AudioFile(tmp_wav) as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.3)
            audio_data = recognizer.record(source)

        text = recognizer.recognize_google(audio_data)

        return SpeechToTextResponse(
            success=True,
            transcription=text,
            message="OK"
        )

    except sr.UnknownValueError:
        return SpeechToTextResponse(success=False, transcription="", message="Could not understand audio")

    except Exception as e:
        return SpeechToTextResponse(success=False, transcription="", message=str(e))

    finally:
        if tmp_in and os.path.exists(tmp_in):
            os.unlink(tmp_in)
        if tmp_wav and os.path.exists(tmp_wav):
            os.unlink(tmp_wav)


# ----------------------------------------------------------
# TTS (unchanged)
# ----------------------------------------------------------
@app.post("/tts")
async def text_to_speech(tts_req: TextToSpeechRequest):
    engine = pyttsx3.init()
    engine.setProperty("rate", tts_req.rate)

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    tmp_path = tmp.name
    tmp.close()

    engine.save_to_file(tts_req.text, tmp_path)
    engine.runAndWait()
    engine.stop()

    audio = open(tmp_path, "rb").read()
    os.unlink(tmp_path)

    return StreamingResponse(io.BytesIO(audio), media_type="audio/wav")


# ----------------------------------------------------------
# Resume Upload (unchanged)
# ----------------------------------------------------------
@app.post("/upload_resume", response_model=ResumeEvaluationResponse)
async def upload_resume(file: UploadFile = File(...), role: str = Form(...)):
    tmp_path = None
    try:
        suffix = ".pdf" if file.filename.endswith(".pdf") else ".txt"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        text = extract_resume_text_from_file(tmp_path)
        if not text:
            return ResumeEvaluationResponse(success=False, resume_summary="N/A", evaluation="N/A",
                                            message="Resume unreadable")

        summary = None
        evaluation_text = None

        if model is not None:
            try:
                ensure_model_ready()

                resp = model.generate_content(
                    f"You are a concise resume evaluator for role: {role}.\nResume:\n{text[:3000]}\n"
                    "Give:\nTechnical Score: X/10\nFeedback (2 sentences)"
                )
                evaluation_text = resp.text.strip()

                summary = model.generate_content(
                    f"Summarize this resume in 2 sentences:\n{text[:2000]}"
                ).text.strip()
            except Exception as e:
                print("Resume analysis model call failed, falling back:", e)

        if not summary or not evaluation_text:
            summary = simple_summary(text, max_sentences=2)
            evaluation_text = simple_resume_evaluation(text, role)

        return ResumeEvaluationResponse(
            success=True,
            resume_text=text[:1000],
            resume_summary=summary,
            evaluation=evaluation_text,
            message="Resume evaluated"
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/apply")
async def apply_for_job(app_req: ApplicationRequest):
    """
    Accepts an application payload from a candidate and writes an application
    document into the employer Firestore using the Firebase Admin SDK.
    Environment:
      - FIREBASE_SERVICE_ACCOUNT_JSON (optional, JSON string)
      - GOOGLE_APPLICATION_CREDENTIALS (optional, path to service account)
    """
    init_firebase_admin()
    if not _ADMIN_INIT_DONE or _ADMIN_DB is None:
        raise HTTPException(status_code=500, detail="Server not configured to persist applications")

    # Basic validation
    if not app_req.jobId or not app_req.candidateId:
        raise HTTPException(status_code=400, detail="Missing jobId or candidateId")

    try:
        job_ref = _ADMIN_DB.collection('jobs').document(app_req.jobId)
        job_snap = job_ref.get()
        if not job_snap.exists:
            raise HTTPException(status_code=404, detail="Job not found")

        job_data = job_snap.to_dict() or {}
        employer_id = job_data.get('employerId')

        application_doc = {
            'jobId': app_req.jobId,
            'employerId': employer_id,
            'candidateId': app_req.candidateId,
            'candidateEmail': app_req.candidateEmail,
            'candidateName': app_req.candidateName,
            'role': app_req.role,
            'resumeSummary': app_req.resumeSummary,
            'qaList': [q.dict() for q in (app_req.qaList or [])],
            'rawEvaluation': app_req.evaluation,
            'createdAt': admin_firestore.SERVER_TIMESTAMP,
        }

        apps_ref = _ADMIN_DB.collection('applications')
        new_ref = apps_ref.document()
        new_ref.set(application_doc)

        return JSONResponse({ 'success': True, 'applicationId': new_ref.id })

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------
# Generate Questions (unchanged)
# ----------------------------------------------------------
@app.post("/generate_questions", response_model=QuestionGenerationResponse)
async def generate_questions(request: QuestionGenerationRequest):
    ensure_model_ready()

    num = max(1, min(15, request.num_questions))

    resp = model.generate_content(
        f"Generate {num} short interview questions for {request.role} at {request.company}.\n"
        f"Resume summary: {request.resume_summary}\nNumbered list:"
    )

    raw = resp.text.split("\n")
    questions = [re.sub(r"^\d+\.\s*", "", q).strip() for q in raw if q.strip()]

    session_id = str(uuid.uuid4())
    QUESTIONS_STORE[session_id] = {"questions": questions, "created": time.time()}

    return QuestionGenerationResponse(success=True, session_id=session_id, questions=questions, message="OK")


@app.get("/questions/{session_id}")
async def get_questions(session_id: str):
    data = QUESTIONS_STORE.get(session_id)
    if not data:
        raise HTTPException(404, "Session expired")
    return {"success": True, "questions": data["questions"]}


# ----------------------------------------------------------
# Interview Evaluation (unchanged)
# ----------------------------------------------------------
@app.post("/evaluate_interview", response_model=InterviewEvaluationResponse)
async def evaluate_interview(req: InterviewEvaluationRequest):
    ensure_model_ready()

    qa_text = "\n".join([f"Q: {q.question}\nA: {q.answer}\n" for q in req.qa_list])

    resp = model.generate_content(
        f"Evaluate interview for role {req.role}.\nResume summary: {req.resume_summary}\nTranscript:\n{qa_text}\n"
        "Give:\nTechnical Score: X/10\nCommunication Score: X/10\nRole-fit Score: X/10\nFinal Score: X/10\n"
        "Feedback (3–5 sentences)"
    )

    parsed = parse_scores_from_text(resp.text)
    final = parsed["final"]

    if final is None and all(parsed[x] for x in ["technical", "communication", "role_fit"]):
        final = round((parsed["technical"] + parsed["communication"] + parsed["role_fit"]) / 3, 2)

    return InterviewEvaluationResponse(
        success=True,
        technical_score=parsed["technical"],
        communication_score=parsed["communication"],
        role_fit_score=parsed["role_fit"],
        final_score=final,
        feedback=parsed["feedback"],
        raw_evaluation=resp.text,
        message="Evaluation complete"
    )


# ----------------------------------------------------------
# RUN
# ----------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    '''

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

    communication_score = (
        6.0 if len(text.split()) > 120 else 5.0
    )

    feedback = (
        f"Technical Score: {technical_score:.1f}/10\n"
        f"Communication Score: {communication_score:.1f}/10\n"
        f"Recommendation: Resume appears relevant for {role}."
    )

    return feedback

# ----------------------------------------------------------
# RESPONSE MODELS
# ----------------------------------------------------------
class ResumeEvaluationResponse(BaseModel):
    success: bool
    resume_text: Optional[str] = None
    resume_summary: str
    evaluation: str
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
    audio_file: UploadFile = File(...)
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

        text = recognizer.recognize_google(audio_data)

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

        evaluation_text = call_gemini(
            f"""
            You are a professional resume evaluator.

            Role: {role}

            Resume:
            {text[:3000]}

            Give:
            Technical Score: X/10
            Communication Score: X/10
            Feedback in 3 concise sentences.
            """
        )

        summary = call_gemini(
            f"""
            Summarize this resume in 2 concise sentences:

            {text[:2000]}
            """
        )

        used_fallback = not summary or not evaluation_text

        if used_fallback:
            summary = simple_summary(text)
            evaluation_text = simple_resume_evaluation(text, role)

        message = "Resume evaluated successfully"
        if used_fallback and model is not None:
            message = (
                "Resume evaluated using offline scoring "
                "(Gemini quota unavailable or API error)"
            )

        return ResumeEvaluationResponse(
            success=True,
            resume_text=text[:1000],
            resume_summary=summary,
            evaluation=evaluation_text,
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