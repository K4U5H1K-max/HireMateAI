import { Sparkles } from 'lucide-react';
import type { InterviewEvaluationResponse } from '../../types';
import { useCountUp } from '../../hooks/useCountUp';
import ScoreRing from './ScoreRing';
import { cn } from '../../lib/cn';

function scoreLabel(score: number | undefined): string {
  if (score == null) return 'Pending';
  if (score >= 9) return 'Outstanding';
  if (score >= 8) return 'Excellent';
  if (score >= 7) return 'Strong performance';
  if (score >= 6) return 'Good foundation';
  if (score >= 4) return 'Room to grow';
  return 'Keep practicing';
}

interface ResultsHeroRevealProps {
  evaluation: InterviewEvaluationResponse;
}

const ResultsHeroReveal = ({ evaluation }: ResultsHeroRevealProps) => {
  const finalScore = evaluation.final_score;
  const { display, done } = useCountUp(finalScore, { duration: 1400, decimals: 1 });
  const isHighScore = finalScore != null && finalScore >= 8;

  return (
    <div className="relative flex flex-col items-center py-6 sm:py-10 mb-8">
      {isHighScore && done && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 rounded-full bg-brand/10 blur-3xl animate-pulse" />
        </div>
      )}

      <div className="relative">
        <ScoreRing score={finalScore} size={220} strokeWidth={12} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-gray-400 text-xs uppercase tracking-widest mb-1">Final Score</span>
          <span className="text-5xl sm:text-6xl font-extrabold tabular-nums text-brand drop-shadow-lg">
            {display}
          </span>
          {finalScore != null && (
            <span className="text-gray-500 text-lg font-medium mt-0.5">/ 10</span>
          )}
        </div>
      </div>

      <div
        className={cn(
          'mt-6 flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-500',
          done ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
          isHighScore
            ? 'bg-green-500/15 border-green-500/40 text-green-300'
            : 'bg-brand-muted border-brand-border text-brand'
        )}
      >
        {isHighScore && <Sparkles className="w-4 h-4" />}
        <span className="text-sm font-semibold">{scoreLabel(finalScore)}</span>
      </div>
    </div>
  );
};

export default ResultsHeroReveal;
