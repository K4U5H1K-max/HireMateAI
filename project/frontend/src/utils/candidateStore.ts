import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
} from 'firebase/firestore/lite';
import { candidateAuth, getCandidateDb } from '../config/candidateFirebase';
import { API_ENDPOINTS } from '../config/api';
import { getEmployerDb } from '../config/employerFirebase';
import type { JobPosting } from '../types/employer';

export interface CandidateApplication {
  id: string;
  candidateId: string;
  jobId: string;
  positionTitle: string;
  companyName: string;
  status: 'pending' | 'accepted' | 'rejected';
  interviewScore?: number;
  feedback?: string;
  submittedAt: number;
  interviewDate?: number;
}

export interface CandidateInterview {
  id: string;
  userId: string;
  jobId?: string | null;
  applicationId?: string | null;
  employerId?: string | null;
  companyName?: string | null;
  role: string;
  resumeSummary: string;
  interviewType: 'video' | 'text';
  scores: {
    technical: number | null;
    communication: number | null;
    roleFit: number | null;
    presence: number | null;
    final: number | null;
  };
  feedback: string | null;
  nonverbalFeedback: string | null;
  createdAt: number;
}

export interface CandidateProfile {
  userId: string;
  email: string;
  displayName?: string;
}

export interface InterviewStats {
  totalInterviews: number;
  avgTechnical: number | null;
  avgCommunication: number | null;
  avgRoleFit: number | null;
  avgPresence: number | null;
  avgFinal: number | null;
}

const getCandidateAuth = () => {
  if (!candidateAuth) {
    throw new Error('Candidate Firebase is not configured.');
  }
  return candidateAuth;
};

export const onCandidateUserChanged = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(getCandidateAuth(), callback);
};

export const signOutCandidate = async () => {
  await signOut(getCandidateAuth());
};

export const getCandidateInterviewHistory = async (userId: string): Promise<CandidateInterview[]> => {
  const db = getCandidateDb();
  const interviewsRef = collection(db, 'candidateUsers', userId, 'interviews');
  const q = query(interviewsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId ?? userId,
      jobId: data.jobId ?? null,
      applicationId: data.applicationId ?? null,
      employerId: data.employerId ?? null,
      companyName: data.companyName ?? null,
      role: String(data.role ?? ''),
      resumeSummary: String(data.resumeSummary ?? ''),
      interviewType: (data.interviewType ?? 'text') as 'video' | 'text',
      scores: {
        technical: typeof data.scores?.technical === 'number' ? data.scores.technical : null,
        communication: typeof data.scores?.communication === 'number' ? data.scores.communication : null,
        roleFit: typeof data.scores?.roleFit === 'number' ? data.scores.roleFit : null,
        presence: typeof data.scores?.presence === 'number' ? data.scores.presence : null,
        final: typeof data.scores?.final === 'number' ? data.scores.final : null,
      },
      feedback: data.feedback ?? null,
      nonverbalFeedback: data.nonverbalFeedback ?? null,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    } as CandidateInterview;
  });
};

export const calculateInterviewStats = (interviews: CandidateInterview[]): InterviewStats => {
  if (interviews.length === 0) {
    return {
      totalInterviews: 0,
      avgTechnical: null,
      avgCommunication: null,
      avgRoleFit: null,
      avgPresence: null,
      avgFinal: null,
    };
  }

  const technicalScores = interviews
    .map((i) => i.scores.technical)
    .filter((s): s is number => s !== null);
  const communicationScores = interviews
    .map((i) => i.scores.communication)
    .filter((s): s is number => s !== null);
  const roleFitScores = interviews
    .map((i) => i.scores.roleFit)
    .filter((s): s is number => s !== null);
  const presenceScores = interviews
    .map((i) => i.scores.presence)
    .filter((s): s is number => s !== null);
  const finalScores = interviews.map((i) => i.scores.final).filter((s): s is number => s !== null);

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b) / arr.length : null);

  return {
    totalInterviews: interviews.length,
    avgTechnical: avg(technicalScores),
    avgCommunication: avg(communicationScores),
    avgRoleFit: avg(roleFitScores),
    avgPresence: avg(presenceScores),
    avgFinal: avg(finalScores),
  };
};

const mapJobPosting = (id: string, data: Record<string, unknown>): JobPosting => {
  const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (value && typeof (value as any).toMillis === 'function') {
      try {
        const ms = (value as any).toMillis();
        if (typeof ms === 'number') return ms;
      } catch {
        // fallthrough
      }
    }
    return 0;
  };

  return {
    id,
    employerId: String(data.employerId ?? ''),
    companyName: String(data.companyName ?? ''),
    positionTitle: String(data.positionTitle ?? ''),
    jobDescription: String(data.jobDescription ?? ''),
    workMode: (String(data.workMode ?? 'remote') as any),
    location: String(data.location ?? ''),
    requirements: String(data.requirements ?? ''),
    minScoreForHumanInterview: toNumber(data.minScoreForHumanInterview),
    status: String(data.status ?? 'open') === 'closed' ? 'closed' : 'open',
    closedAt: toNumber(data.closedAt) || undefined,
    createdAt: toNumber(data.createdAt),
    updatedAt: toNumber(data.updatedAt),
  };
};

export const getEmployerJobsAvailable = async (): Promise<JobPosting[]> => {
  try {
    const db = getEmployerDb();
    const jobsRef = collection(db, 'jobs');
    const q = query(jobsRef, where('status', '==', 'open'));
    const snapshot = await getDocs(q);

    const jobs = snapshot.docs.map((doc) =>
      mapJobPosting(doc.id, doc.data() as Record<string, unknown>)
    );

    // Sort by createdAt descending client-side
    return jobs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) {
    console.error('Error fetching jobs:', err);
    return [];
  }
};

export const getCandidateApplications = async (): Promise<CandidateApplication[]> => {
  try {
    const user = candidateAuth.currentUser;
    if (!user) return [];

    const idToken = await user.getIdToken();
    const response = await fetch(`${API_ENDPOINTS.candidateApplications}?candidateId=${encodeURIComponent(user.uid)}`, {
      headers: {
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as { applications?: CandidateApplication[] };
    return (data.applications ?? []).sort((a, b) => b.submittedAt - a.submittedAt);
  } catch (err) {
    console.error('Error fetching applications:', err);
    return [];
  }
};
