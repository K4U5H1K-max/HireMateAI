import { cn } from '../../lib/cn';

interface InterviewQuestionProgressProps {
  current: number;
  total: number;
  className?: string;
}

/** Segmented bar for questions within an interview session. */
const InterviewQuestionProgress = ({
  current,
  total,
  className,
}: InterviewQuestionProgressProps) => {
  return (
    <div className={cn('space-y-2', className)} aria-label={`Question ${current} of ${total}`}>
      <div className="flex justify-between text-xs text-gray-500">
        <span>Question progress</span>
        <span className="text-brand font-medium">
          {current} / {total}
        </span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-all duration-500',
              i < current ? 'bg-brand shadow-glow' : i === current ? 'bg-brand/60' : 'bg-white/10'
            )}
          />
        ))}
      </div>
    </div>
  );
};

export default InterviewQuestionProgress;
