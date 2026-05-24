import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Video, Calendar, MessageSquare } from 'lucide-react';
import type { CandidateInterview } from '../utils/candidateStore';
import ElectricBackground from '../components/ElectricBackground';
import PageContainer from '../components/layout/PageContainer';
import { Button, Card, Badge } from '../components/ui';
import AnimatedScoreCard from '../components/results/AnimatedScoreCard';

interface LocationState {
  interview: CandidateInterview;
}

const InterviewDetailsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  if (!state?.interview) {
    return (
      <div className="relative flex-1 min-h-screen flex items-center justify-center">
        <ElectricBackground className="z-0 opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-raised/70 to-surface pointer-events-none z-[1]" />
        <div className="relative z-10 text-center">
          <p className="text-gray-400 mb-4">Interview not found</p>
          <Button onClick={() => navigate('/student-dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const interview = state.interview;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="relative flex-1 min-h-0">
      <ElectricBackground className="z-0 opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-surface-raised/70 to-surface pointer-events-none z-[1]" />

      <PageContainer className="relative z-10">
        {/* Back Button */}
        <button
          onClick={() => navigate('/student-dashboard')}
          className="flex items-center gap-2 text-brand hover:text-brand-muted transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-start gap-4 mb-4">
            {interview.interviewType === 'video' ? (
              <Video className="w-8 h-8 text-brand mt-1" />
            ) : (
              <FileText className="w-8 h-8 text-brand mt-1" />
            )}
            <div>
              <h1 className="text-4xl font-extrabold text-white">
                Interview: <span className="text-brand">{interview.role}</span>
              </h1>
              <p className="text-gray-400 mt-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(interview.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Badge>{interview.interviewType === 'video' ? 'Video Interview' : 'Text Interview'}</Badge>
          </div>
        </div>

        {/* Score Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
          {interview.scores.technical !== null && (
            <div>
              <AnimatedScoreCard
                label="Technical"
                score={interview.scores.technical}
                maxScore={10}
                animated={false}
              />
            </div>
          )}
          {interview.scores.communication !== null && (
            <div>
              <AnimatedScoreCard
                label="Communication"
                score={interview.scores.communication}
                maxScore={10}
                animated={false}
              />
            </div>
          )}
          {interview.scores.roleFit !== null && (
            <div>
              <AnimatedScoreCard
                label="Role Fit"
                score={interview.scores.roleFit}
                maxScore={10}
                animated={false}
              />
            </div>
          )}
          {interview.scores.presence !== null && (
            <div>
              <AnimatedScoreCard
                label="Presence"
                score={interview.scores.presence}
                maxScore={10}
                animated={false}
              />
            </div>
          )}
          {interview.scores.final !== null && (
            <div>
              <AnimatedScoreCard
                label="Final Score"
                score={interview.scores.final}
                maxScore={10}
                animated={false}
              />
            </div>
          )}
        </div>

        {/* Resume Summary */}
        {interview.resumeSummary && (
          <Card variant="ghost" padding="md" className="mb-10">
            <h2 className="text-lg font-semibold text-white mb-3">Resume Summary</h2>
            <p className="text-gray-300 leading-relaxed">{interview.resumeSummary}</p>
          </Card>
        )}

        {/* Feedback */}
        {interview.feedback && (
          <Card variant="ghost" padding="md" className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-brand" />
              <h2 className="text-lg font-semibold text-white">Feedback</h2>
            </div>
            <p className="text-gray-300 leading-relaxed whitespace-pre-line">
              {interview.feedback}
            </p>
          </Card>
        )}

        {/* Nonverbal Feedback */}
        {interview.nonverbalFeedback && (
          <Card variant="ghost" padding="md" className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <Video className="w-5 h-5 text-brand" />
              <h2 className="text-lg font-semibold text-white">Body Language & Presence Feedback</h2>
            </div>
            <p className="text-gray-300 leading-relaxed whitespace-pre-line">
              {interview.nonverbalFeedback}
            </p>
          </Card>
        )}

        {/* CTA */}
        <div className="flex gap-4">
          <Button fullWidth size="lg" onClick={() => navigate('/student-dashboard')}>
            Back to Dashboard
          </Button>
          <Button fullWidth size="lg" onClick={() => navigate('/resume-analyzer')}>
            Practice Again
          </Button>
        </div>
      </PageContainer>
    </div>
  );
};

export default InterviewDetailsPage;
