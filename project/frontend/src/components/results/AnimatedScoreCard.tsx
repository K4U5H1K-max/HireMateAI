import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

interface AnimatedScoreCardProps {
  icon: LucideIcon;
  label: string;
  score: number | undefined;
  delayMs?: number;
  getScoreColor: (score?: number) => string;
}

const AnimatedScoreCard = ({
  icon: Icon,
  label,
  score,
  delayMs = 0,
  getScoreColor,
}: AnimatedScoreCardProps) => {
  const [visible, setVisible] = useState(false);
  const [barWidth, setBarWidth] = useState('0%');

  useEffect(() => {
    const showTimer = window.setTimeout(() => setVisible(true), delayMs);
    const barTimer = window.setTimeout(() => {
      if (score != null) setBarWidth(`${(score / 10) * 100}%`);
    }, delayMs + 120);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(barTimer);
    };
  }, [delayMs, score]);

  return (
    <div
      className={cn(
        'bg-surface-overlay border border-brand-border rounded-xl p-5 transition-all duration-500',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <Icon className="w-5 h-5 text-brand shrink-0" />
        <h3 className="text-white font-semibold text-sm leading-tight">{label}</h3>
      </div>
      <div className={cn('text-3xl font-bold mb-3 tabular-nums', getScoreColor(score))}>
        {score?.toFixed(1) ?? 'N/A'}
        {score != null && <span className="text-lg text-gray-500 font-medium">/10</span>}
      </div>
      <div className="w-full bg-gray-700/80 rounded-full h-2 overflow-hidden">
        <div
          className="bg-brand h-2 rounded-full transition-[width] duration-1000 ease-out shadow-glow"
          style={{ width: barWidth }}
        />
      </div>
    </div>
  );
};

export default AnimatedScoreCard;
