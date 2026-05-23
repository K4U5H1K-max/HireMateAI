import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export type AppStepId = 'home' | 'resume' | 'interview' | 'results';

export interface AppStep {
  id: AppStepId;
  label: string;
  paths: string[];
}

export const APP_STEPS: AppStep[] = [
  { id: 'home', label: 'Home', paths: ['/'] },
  { id: 'resume', label: 'Resume', paths: ['/resume-analyzer'] },
  { id: 'interview', label: 'Interview', paths: ['/interview', '/video-interview'] },
  { id: 'results', label: 'Results', paths: ['/results'] },
];

export function getStepIndex(pathname: string): number {
  const idx = APP_STEPS.findIndex((step) => step.paths.includes(pathname));
  return idx === -1 ? 0 : idx;
}

interface StepProgressProps {
  currentIndex: number;
  className?: string;
}

const StepProgress = ({ currentIndex, className }: StepProgressProps) => {
  return (
    <nav aria-label="Interview progress" className={cn('w-full', className)}>
      <ol className="flex items-center gap-1 sm:gap-2">
        {APP_STEPS.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isUpcoming = index > currentIndex;

          return (
            <li key={step.id} className="flex flex-1 items-center min-w-0">
              <div
                className={cn(
                  'flex flex-col sm:flex-row items-center gap-1 sm:gap-2 min-w-0 flex-1',
                  isUpcoming && 'opacity-40'
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold border transition-colors duration-300',
                    isComplete && 'bg-brand text-black border-brand',
                    isCurrent && 'bg-brand-muted text-brand border-brand shadow-glow',
                    isUpcoming && 'bg-white/5 text-gray-500 border-white/10'
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isComplete ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : index + 1}
                </span>
                <span
                  className={cn(
                    'text-[10px] sm:text-xs font-medium truncate',
                    isCurrent ? 'text-brand' : isComplete ? 'text-gray-300' : 'text-gray-500'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < APP_STEPS.length - 1 && (
                <div
                  className="hidden sm:block h-px flex-1 mx-1 min-w-[8px] max-w-[40px] bg-white/10 overflow-hidden rounded-full"
                  aria-hidden
                >
                  <div
                    className={cn(
                      'h-full bg-brand transition-all duration-500 ease-out',
                      isComplete ? 'w-full' : 'w-0'
                    )}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default StepProgress;
