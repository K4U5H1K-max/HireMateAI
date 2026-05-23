import type { NonverbalMetrics, QAPair } from '../types';

function toInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

export function sanitizeNonverbal(raw: unknown): NonverbalMetrics | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const m = raw as Record<string, unknown>;
  return {
    duration_sec: toInt(m.duration_sec),
    smile_pct: toInt(m.smile_pct),
    nod_count: toInt(m.nod_count),
    gaze_away_pct: toInt(m.gaze_away_pct),
    lean_forward_pct: toInt(m.lean_forward_pct),
    lean_back_pct: toInt(m.lean_back_pct),
    engagement_score: toInt(m.engagement_score, 50),
  };
}

export function buildEvaluationPayload(
  qaList: QAPair[],
  role: string,
  resumeSummary: string | undefined,
  isVideoInterview: boolean
) {
  return {
    qa_list: qaList.map((qa) => ({
      question: qa.question,
      answer: qa.answer,
      ...(qa.nonverbal ? { nonverbal: sanitizeNonverbal(qa.nonverbal) } : {}),
    })),
    role: role || 'Candidate',
    resume_summary: resumeSummary || 'No resume summary provided.',
    is_video_interview: Boolean(isVideoInterview),
  };
}
