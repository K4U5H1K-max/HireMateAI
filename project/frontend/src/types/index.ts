export interface ResumeEvaluationResponse {
  success: boolean;
  resume_text?: string;
  resume_summary: string;
  evaluation: string;
  message: string;
}

export interface QuestionGenerationResponse {
  success: boolean;
  session_id: string;
  questions: string[];
  message: string;
}

export interface NonverbalMetrics {
  duration_sec: number;
  smile_pct: number;
  nod_count: number;
  gaze_away_pct: number;
  lean_forward_pct: number;
  lean_back_pct: number;
  engagement_score: number;
}

export interface QAPair {
  question: string;
  answer: string;
  nonverbal?: NonverbalMetrics;
}

export interface InterviewEvaluationResponse {
  success: boolean;
  technical_score?: number;
  communication_score?: number;
  role_fit_score?: number;
  presence_score?: number;
  final_score?: number;
  feedback?: string;
  nonverbal_feedback?: string;
  raw_evaluation?: string;
  message: string;
}

export interface SpeechToTextResponse {
  success: boolean;
  transcription: string;
  message: string;
}
