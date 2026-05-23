import { addDoc, collection, serverTimestamp } from 'firebase/firestore/lite';
import { candidateAuth, getCandidateDb } from '../config/candidateFirebase';
import type { InterviewEvaluationResponse, QAPair } from '../types';

interface CandidateInterviewMemoryInput {
  role: string;
  resumeSummary: string;
  qaList: QAPair[];
  evaluation: InterviewEvaluationResponse;
  isVideoInterview: boolean;
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
    role: input.role,
    resumeSummary: input.resumeSummary,
    qaList: input.qaList,
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
  if (!candidateAuth) {
    throw new Error('Candidate auth not configured');
  }

  const user = candidateAuth.currentUser;
  if (!user) {
    throw new Error('Not signed in');
  }

  const idToken = await user.getIdToken();

  const payload = {
    jobId: input.jobId,
    candidateId: user.uid,
    candidateEmail: user.email || null,
    candidateName: user.displayName || null,
    role: input.role,
    resumeSummary: input.resumeSummary,
    qaList: input.qaList,
    evaluation: input.evaluation,
  };

  const backend = (import.meta as any).env.VITE_API_BASE || 'http://localhost:8000';

  const resp = await fetch(`${backend}/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => null);
    throw new Error(body || 'Failed to submit application');
  }
};
