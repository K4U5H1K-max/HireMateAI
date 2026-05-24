import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore/lite';
import { employerAuth, getEmployerDb } from '../config/employerFirebase';
import type {
  EmployerProfile,
  JobApplication,
  JobPosting,
  JobPostingWithStats,
  WorkMode,
} from '../types/employer';

interface EmployerProfileInput {
  companyName: string;
  employerPosition: string;
  contactName: string;
  contactEmail: string;
  phoneNumber: string;
  website?: string;
  companyDescription?: string;
}

interface JobPostingInput {
  companyName: string;
  positionTitle: string;
  jobDescription: string;
  workMode: WorkMode;
  location: string;
  requirements: string;
  minScoreForHumanInterview: number;
}

const getScoreValue = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const getApplicationRankScore = (application: Pick<JobApplication, 'resumeScore' | 'technicalScore' | 'communicationScore' | 'nonverbalScore' | 'finalScore'>): number => {
  const values = [
    application.resumeScore,
    application.technicalScore,
    application.communicationScore,
    application.nonverbalScore,
    application.finalScore,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (!values.length) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
};

const getEmployerAuth = () => {
  if (!employerAuth) {
    throw new Error('Employer Firebase is not configured.');
  }

  return employerAuth;
};

const normalizeString = (value: string) => value.trim();

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  // Firestore Timestamp objects expose a `toMillis()` method
  if (value && typeof (value as any).toMillis === 'function') {
    try {
      const ms = (value as any).toMillis();
      if (typeof ms === 'number' && Number.isFinite(ms)) return ms;
    } catch {
      // fallthrough to return 0
    }
  }
  return 0;
};

const mapProfile = (userId: string, data: Record<string, unknown>): EmployerProfile => ({
  userId,
  companyName: String(data.companyName ?? ''),
  employerPosition: String(data.employerPosition ?? ''),
  contactName: String(data.contactName ?? ''),
  contactEmail: String(data.contactEmail ?? ''),
  phoneNumber: String(data.phoneNumber ?? ''),
  website: data.website ? String(data.website) : undefined,
  companyDescription: data.companyDescription ? String(data.companyDescription) : undefined,
  createdAt: toNumber(data.createdAt),
  updatedAt: toNumber(data.updatedAt),
});

const mapJobPosting = (id: string, data: Record<string, unknown>): JobPosting => ({
  id,
  employerId: String(data.employerId ?? ''),
  companyName: String(data.companyName ?? ''),
  positionTitle: String(data.positionTitle ?? ''),
  jobDescription: String(data.jobDescription ?? ''),
  workMode: (String(data.workMode ?? 'remote') as WorkMode),
  location: String(data.location ?? ''),
  requirements: String(data.requirements ?? ''),
  minScoreForHumanInterview: toNumber(data.minScoreForHumanInterview),
  status: String(data.status ?? 'open') === 'closed' ? 'closed' : 'open',
  closedAt: toNumber(data.closedAt) || undefined,
  createdAt: toNumber(data.createdAt),
  updatedAt: toNumber(data.updatedAt),
});

const mapApplication = (id: string, data: Record<string, unknown>): JobApplication => ({
  id,
  jobId: String(data.jobId ?? ''),
  candidateName: String(data.candidateName ?? 'Unknown Candidate'),
  candidateEmail: String(data.candidateEmail ?? 'N/A'),
  resumeScore: getScoreValue(data.resumeScore ?? data.roleFitScore),
  technicalScore: getScoreValue(data.technicalScore),
  communicationScore: getScoreValue(data.communicationScore),
  roleFitScore: getScoreValue(data.roleFitScore),
  nonverbalScore: getScoreValue(data.nonverbalScore ?? data.presenceScore ?? data.presence_score),
  finalScore: Number(data.finalScore ?? 0),
  qualifiedForHumanInterview: Boolean(data.qualifiedForHumanInterview),
  resumeSummary: data.resumeSummary ? String(data.resumeSummary) : undefined,
  qaList: Array.isArray(data.qaList)
    ? data.qaList
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const entry = item as Record<string, unknown>;
          return {
            question: String(entry.question ?? ''),
            answer: String(entry.answer ?? ''),
          };
        })
        .filter((item): item is { question: string; answer: string } => Boolean(item?.question || item?.answer))
    : undefined,
  feedback: data.feedback ? String(data.feedback) : undefined,
  nonverbalFeedback: data.nonverbalFeedback ? String(data.nonverbalFeedback) : undefined,
  rawEvaluation: data.rawEvaluation ? String(data.rawEvaluation) : undefined,
  createdAt: toNumber(data.createdAt),
});

export const onEmployerUserChanged = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(getEmployerAuth(), callback);
};

export const signOutEmployer = async () => {
  await signOut(getEmployerAuth());
};

export const getEmployerProfile = async (userId: string): Promise<EmployerProfile | null> => {
  const db = getEmployerDb();
  const profileSnap = await getDoc(doc(db, 'employerProfiles', userId));
  if (!profileSnap.exists()) {
    return null;
  }
  return mapProfile(userId, profileSnap.data() as Record<string, unknown>);
};

export const saveEmployerProfile = async (
  userId: string,
  profile: EmployerProfileInput
): Promise<void> => {
  const db = getEmployerDb();
  const profileRef = doc(db, 'employerProfiles', userId);
  const existing = await getDoc(profileRef);
  const now = Date.now();
  const existingData = existing.exists() ? (existing.data() as Record<string, unknown>) : null;
  const existingCreatedAt = existingData ? toNumber(existingData.createdAt) : 0;

  await setDoc(
    profileRef,
    {
      companyName: normalizeString(profile.companyName),
      employerPosition: normalizeString(profile.employerPosition),
      contactName: normalizeString(profile.contactName),
      contactEmail: normalizeString(profile.contactEmail),
      phoneNumber: normalizeString(profile.phoneNumber),
      website: normalizeString(profile.website ?? ''),
      companyDescription: normalizeString(profile.companyDescription ?? ''),
      createdAt: existing.exists() ? (existingCreatedAt || now) : now,
      updatedAt: now,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const createEmployerJob = async (
  employerId: string,
  input: JobPostingInput
): Promise<string> => {
  const db = getEmployerDb();
  const now = Date.now();

  const jobDoc = await addDoc(collection(db, 'jobs'), {
    employerId,
    companyName: normalizeString(input.companyName),
    positionTitle: normalizeString(input.positionTitle),
    jobDescription: normalizeString(input.jobDescription),
    workMode: input.workMode,
    location: normalizeString(input.location),
    requirements: normalizeString(input.requirements),
    minScoreForHumanInterview: Math.min(10, Math.max(0, Number(input.minScoreForHumanInterview))),
    status: 'open',
    closedAt: null,
    createdAt: now,
    updatedAt: now,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });

  return jobDoc.id;
};

export const getEmployerJobsWithStats = async (
  employerId: string
): Promise<JobPostingWithStats[]> => {
  const db = getEmployerDb();
  const jobsQuery = query(collection(db, 'jobs'), where('employerId', '==', employerId));
  const jobsSnapshot = await getDocs(jobsQuery);
  const jobs = jobsSnapshot.docs.map((jobDoc) =>
    mapJobPosting(jobDoc.id, jobDoc.data() as Record<string, unknown>)
  );

  // sort client-side to avoid requiring a composite index in Firestore
  jobs.sort((a, b) => b.createdAt - a.createdAt);

  const jobsWithStats = await Promise.all(
    jobs.map(async (job) => {
      const appsQuery = query(collection(db, 'applications'), where('jobId', '==', job.id));
      const appsSnapshot = await getDocs(appsQuery);
      const applicants = appsSnapshot.docs.map((appDoc) =>
        mapApplication(appDoc.id, appDoc.data() as Record<string, unknown>)
      );

      // sort applications by createdAt desc, then by computed rank
      applicants.sort((a, b) => b.createdAt - a.createdAt);
      applicants.sort((left, right) => getApplicationRankScore(left) - getApplicationRankScore(right));

      const applicantsCount = applicants.length;
      const qualifiedCount = applicants.filter((app) => app.qualifiedForHumanInterview).length;
      const scoreSum = applicants.reduce((acc, app) => acc + app.finalScore, 0);
      const averageFinalScore = applicantsCount ? Number((scoreSum / applicantsCount).toFixed(2)) : 0;

      return {
        ...job,
        applicantsCount,
        qualifiedCount,
        averageFinalScore,
      };
    })
  );

  return jobsWithStats;
};

export const getEmployerJobById = async (
  employerId: string,
  jobId: string
): Promise<JobPosting | null> => {
  const db = getEmployerDb();
  const jobSnap = await getDoc(doc(db, 'jobs', jobId));
  if (!jobSnap.exists()) {
    return null;
  }

  const job = mapJobPosting(jobSnap.id, jobSnap.data() as Record<string, unknown>);
  if (job.employerId !== employerId) {
    throw new Error('Unauthorized access to this job.');
  }

  return job;
};

export const getApplicationsForJob = async (
  employerId: string,
  jobId: string
): Promise<JobApplication[]> => {
  const db = getEmployerDb();

  const job = await getEmployerJobById(employerId, jobId);
  if (!job) {
    return [];
  }

  const appsQuery = query(
    collection(db, 'applications'),
    where('jobId', '==', jobId)
  );

  const appsSnapshot = await getDocs(appsQuery);
  const applications = appsSnapshot.docs.map((appDoc) =>
    mapApplication(appDoc.id, appDoc.data() as Record<string, unknown>)
  );

  // client-side sort: newest first, then by computed rank
  applications.sort((a, b) => b.createdAt - a.createdAt);
  return applications.sort((left, right) => getApplicationRankScore(left) - getApplicationRankScore(right));
};

export const closeEmployerJob = async (employerId: string, jobId: string): Promise<void> => {
  const db = getEmployerDb();
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await getDoc(jobRef);

  if (!jobSnap.exists()) {
    throw new Error('Job not found.');
  }

  const job = mapJobPosting(jobSnap.id, jobSnap.data() as Record<string, unknown>);
  if (job.employerId !== employerId) {
    throw new Error('Unauthorized access to this job.');
  }

  const now = Date.now();
  await updateDoc(jobRef, {
    status: 'closed',
    closedAt: now,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
};

export const openEmployerJob = async (employerId: string, jobId: string): Promise<void> => {
  const db = getEmployerDb();
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await getDoc(jobRef);

  if (!jobSnap.exists()) {
    throw new Error('Job not found.');
  }

  const job = mapJobPosting(jobSnap.id, jobSnap.data() as Record<string, unknown>);
  if (job.employerId !== employerId) {
    throw new Error('Unauthorized access to this job.');
  }

  const now = Date.now();
  await updateDoc(jobRef, {
    status: 'open',
    closedAt: null,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });
};
