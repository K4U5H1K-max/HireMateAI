export type WorkMode = 'remote' | 'on-site' | 'hybrid';

export interface EmployerProfile {
  userId: string;
  companyName: string;
  employerPosition: string;
  contactName: string;
  contactEmail: string;
  phoneNumber: string;
  website?: string;
  companyDescription?: string;
  createdAt: number;
  updatedAt: number;
}

export interface JobPosting {
  id: string;
  employerId: string;
  companyName: string;
  positionTitle: string;
  jobDescription: string;
  workMode: WorkMode;
  location: string;
  requirements: string;
  minScoreForHumanInterview: number;
  status: 'open' | 'closed';
  closedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface JobApplication {
  id: string;
  candidateId?: string;
  employerId?: string;
  jobId: string;
  positionTitle?: string;
  companyName?: string;
  candidateName: string;
  candidateEmail: string;
  technicalScore?: number;
  communicationScore?: number;
  roleFitScore?: number;
  resumeScore?: number;
  nonverbalScore?: number;
  finalScore: number;
  qualifiedForHumanInterview: boolean;
  status?: string;
  interviewStatus?: string;
  interviewScore?: number;
  submittedAt?: number;
  interviewDate?: number;
  resumeSummary?: string;
  qaList?: Array<{ question: string; answer: string }>;
  feedback?: string;
  nonverbalFeedback?: string;
  rawEvaluation?: string;
  createdAt: number;
}

export interface JobPostingWithStats extends JobPosting {
  applicantsCount: number;
  qualifiedCount: number;
  averageFinalScore: number;
}
