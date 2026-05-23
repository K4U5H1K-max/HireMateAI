import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Download, Loader2, MessageSquare, Target, TrendingUp, Video } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import type { QAPair, InterviewEvaluationResponse } from '../types';
import { generatePDF } from '../utils/pdfGenerator';
import { buildEvaluationPayload } from '../utils/evaluationPayload';
import PageContainer from '../components/layout/PageContainer';
import { Button, Card, Badge } from '../components/ui';
import ResultsHeroReveal from '../components/results/ResultsHeroReveal';
import ScoreRadarChart from '../components/results/ScoreRadarChart';
import AnimatedScoreCard from '../components/results/AnimatedScoreCard';
import FeedbackReveal from '../components/results/FeedbackReveal';

interface LocationState {
  qaList: QAPair[];
  role: string;
  resumeSummary: string;
  isVideoInterview?: boolean;
}

const ResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  const [evaluation, setEvaluation] = useState<InterviewEvaluationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!state) {
      navigate('/');
      return;
    }
    evaluateInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const evaluateInterview = async () => {
    try {
      const payload = buildEvaluationPayload(
        state.qaList,
        state.role,
        state.resumeSummary,
        Boolean(state.isVideoInterview)
      );

      const response = await fetch(API_ENDPOINTS.evaluateInterview, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        const detail =
          errBody?.detail &&
          (Array.isArray(errBody.detail)
            ? errBody.detail.map((d: { msg?: string }) => d.msg).join('; ')
            : String(errBody.detail));
        throw new Error(detail || 'Failed to evaluate interview');
      }

      const data: InterviewEvaluationResponse = await response.json();
      setEvaluation(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate interview');
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!evaluation) return;
    generatePDF(evaluation, state.qaList, state.role);
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-brand';
    if (score >= 4) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="text-center max-w-md px-4">
          <Loader2 className="w-14 h-14 text-brand animate-spin mx-auto mb-4" />
          <p className="text-white text-lg font-medium">Evaluating your interview…</p>
          <p className="text-gray-500 text-sm mt-2">
            Reviewing answers · Scoring technical depth · Building feedback
          </p>
        </div>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-6">{error || 'No evaluation data available'}</p>
          <Button onClick={() => navigate('/')}>Return Home</Button>
        </div>
      </div>
    );
  }

  const scoreCards = [
    { icon: Target, label: 'Technical', score: evaluation.technical_score },
    { icon: MessageSquare, label: 'Communication', score: evaluation.communication_score },
    { icon: TrendingUp, label: 'Role Fit', score: evaluation.role_fit_score },
    ...(evaluation.presence_score != null
      ? [{ icon: Video, label: 'Presence', score: evaluation.presence_score }]
      : []),
  ];

  const radarAxes = [
    { label: 'Technical', value: evaluation.technical_score },
    { label: 'Communication', value: evaluation.communication_score },
    { label: 'Role Fit', value: evaluation.role_fit_score },
    ...(evaluation.presence_score != null
      ? [{ label: 'Presence', value: evaluation.presence_score }]
      : []),
  ];

  const cardBaseDelay = 900;

  return (
    <PageContainer className="max-w-5xl">
      <div className="text-center mb-2">
        <Badge className="mb-4">Step 4 — Results</Badge>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Interview Results</h1>
        <p className="text-gray-400">Role: {state.role}</p>
      </div>

      <Card variant="elevated" padding="lg" className="mb-6 overflow-hidden">
        <ResultsHeroReveal evaluation={evaluation} />

        <div className="grid lg:grid-cols-2 gap-8 items-center border-t border-white/5 pt-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 text-center lg:text-left">
              Performance profile
            </h3>
            <ScoreRadarChart axes={radarAxes} size={260} className="mx-auto lg:mx-0" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {scoreCards.map((card, index) => (
              <AnimatedScoreCard
                key={card.label}
                icon={card.icon}
                label={card.label}
                score={card.score}
                delayMs={cardBaseDelay + index * 120}
                getScoreColor={getScoreColor}
              />
            ))}
          </div>
        </div>
      </Card>

      {evaluation.feedback && (
        <FeedbackReveal
          title="Verbal Feedback"
          content={evaluation.feedback}
          variant="verbal"
          delayMs={cardBaseDelay + scoreCards.length * 120 + 200}
        />
      )}

      {evaluation.nonverbal_feedback && (
        <FeedbackReveal
          title="Body Language & Interviewer Perspective"
          content={evaluation.nonverbal_feedback}
          variant="nonverbal"
          delayMs={cardBaseDelay + scoreCards.length * 120 + 350}
        />
      )}

      {evaluation.raw_evaluation && !evaluation.feedback && !evaluation.nonverbal_feedback && (
        <FeedbackReveal
          title="Detailed Evaluation"
          content={evaluation.raw_evaluation}
          delayMs={cardBaseDelay + 200}
        />
      )}

      <Card variant="default" padding="md" className="mb-6 animate-fade-in">
        <h3 className="text-xl font-semibold text-brand mb-4">Interview Transcript</h3>
        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
          {state.qaList.map((qa, index) => (
            <div
              key={index}
              className="bg-surface-overlay border border-brand-border/50 rounded-lg p-4"
            >
              <p className="text-brand font-semibold mb-2 text-sm">
                Q{index + 1}: {qa.question}
              </p>
              <p className="text-gray-200 text-sm ml-2">{qa.answer}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row gap-4">
        <Button variant="ghost" fullWidth size="lg" onClick={() => navigate('/')}>
          <Home className="w-5 h-5" />
          Return to Home
        </Button>
        <Button fullWidth size="lg" onClick={handleDownloadPDF}>
          <Download className="w-5 h-5" />
          Download Result (PDF)
        </Button>
      </div>
    </PageContainer>
  );
};

export default ResultsPage;

