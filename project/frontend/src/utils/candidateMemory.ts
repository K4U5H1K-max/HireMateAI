import { addDoc, collection, serverTimestamp } from 'firebase/firestore/lite';
import { candidateAuth, getCandidateDb } from '../config/candidateFirebase';
import type { InterviewEvaluationResponse, QAPair } from '../types';

const GUEST_CANDIDATE_ID_KEY = 'hiremate_guest_candidate_id';

const getGuestCandidateId = (): string => {
  if (typeof window === 'undefined') {
    return `guest-${Date.now()}`;
  }

  const existing = window.localStorage.getItem(GUEST_CANDIDATE_ID_KEY);
  if (existing) {
    return existing;
  }

  const created = `guest-${crypto.randomUUID()}`;
  window.localStorage.setItem(GUEST_CANDIDATE_ID_KEY, created);
  return created;
};

interface CandidateInterviewMemoryInput {
  role: string;
  resumeSummary: string;
  qaList: QAPair[];
  evaluation: InterviewEvaluationResponse;
  isVideoInterview: boolean;
  jobId?: string;
}

export const saveCandidateInterviewMemory = async (
  input: CandidateInterviewMemoryInput
): Promise<void> => {
  if (!candidateAuth) {
    return;
  }

  const user = candidateAuth.currentUser;
  if (!user) {
    return;
  }

  const candidateDb = getCandidateDb();

  const now = Date.now();
  await addDoc(collection(candidateDb, 'candidateUsers', user.uid, 'interviews'), {
    userId: user.uid,
    jobId: input.jobId ?? null,
    role: input.role,
    resumeSummary: input.resumeSummary,
    qaList: input.qaList.map((qa) => ({
      question: qa.question ?? '',
      answer: qa.answer ?? '',
      nonverbal: qa.nonverbal
        ? {
            duration_sec: qa.nonverbal.duration_sec ?? 0,
            smile_pct: qa.nonverbal.smile_pct ?? 0,
            nod_count: qa.nonverbal.nod_count ?? 0,
            gaze_away_pct: qa.nonverbal.gaze_away_pct ?? 0,
            lean_forward_pct: qa.nonverbal.lean_forward_pct ?? 0,
            lean_back_pct: qa.nonverbal.lean_back_pct ?? 0,
            engagement_score: qa.nonverbal.engagement_score ?? 0,
          }
        : null,
    })),
    interviewType: input.isVideoInterview ? 'video' : 'text',
    scores: {
      technical: input.evaluation.technical_score ?? null,
      communication: input.evaluation.communication_score ?? null,
      roleFit: input.evaluation.role_fit_score ?? null,
      presence: input.evaluation.presence_score ?? null,
      final: input.evaluation.final_score ?? null,
    },
    feedback: input.evaluation.feedback ?? null,
    nonverbalFeedback: input.evaluation.nonverbal_feedback ?? null,
    createdAt: now,
    serverCreatedAt: serverTimestamp(),
  });
};

interface ApplyToJobInput {
  jobId: string;
  role: string;
  resumeSummary: string;
  qaList: QAPair[];
  evaluation: InterviewEvaluationResponse;
}

export const applyToJob = async (input: ApplyToJobInput): Promise<void> => {
  const user = candidateAuth?.currentUser ?? null;
  const candidateId = user?.uid ?? getGuestCandidateId();
  const candidateEmail = user?.email || null;
  const candidateName = user?.displayName || null;

  const idToken = user ? await user.getIdToken() : null;

  const payload = {
    jobId: input.jobId,
    candidateId,
    candidateEmail,
    candidateName,
    role: input.role,
    resumeSummary: input.resumeSummary,
    qaList: input.qaList,
    evaluation: input.evaluation,
  };

  // const backend = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000';
  const backend =
  (import.meta as any).env.VITE_API_URL ||
  'https://hiremateai-ty49.onrender.com';

  const resp = await fetch(`${backend}/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => null);
    throw new Error(body || 'Failed to submit application');
  }
};
