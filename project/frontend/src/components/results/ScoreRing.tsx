import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';

interface ScoreRingProps {
  score: number | undefined | null;
  /** 0–1 animation progress driven by parent or internal delay */
  progress?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const ScoreRing = ({
  score,
  progress: progressProp,
  size = 200,
  strokeWidth = 10,
  className,
}: ScoreRingProps) => {
  const [internalProgress, setInternalProgress] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalized = score != null ? Math.min(Math.max(score / 10, 0), 1) : 0;

  useEffect(() => {
    if (progressProp != null) return;
    const t = window.setTimeout(() => {
      let start: number | null = null;
      const duration = 1400;
      const step = (now: number) => {
        if (start == null) start = now;
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setInternalProgress(eased);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, 150);
    return () => clearTimeout(t);
  }, [progressProp, score]);

  const progress = progressProp ?? internalProgress;
  const offset = circumference * (1 - normalized * progress);

  const ringColor =
    score == null
      ? 'stroke-gray-600'
      : score >= 8
        ? 'stroke-green-400'
        : score >= 6
          ? 'stroke-brand'
          : score >= 4
            ? 'stroke-yellow-400'
            : 'stroke-red-400';

  return (
    <svg
      width={size}
      height={size}
      className={cn('rotate-[-90deg]', className)}
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-white/10"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className={cn(ringColor, 'drop-shadow-[0_0_12px_rgba(5,252,211,0.45)]')}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: progressProp != null ? 'stroke-dashoffset 0.05s linear' : undefined }}
      />
    </svg>
  );
};

export default ScoreRing;
