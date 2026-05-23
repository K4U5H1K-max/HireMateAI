import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';
import { Card } from '../ui';
import { parseFeedbackSections } from '../../utils/parseFeedbackSections';
import { cn } from '../../lib/cn';

interface FeedbackRevealProps {
  title: string;
  content: string;
  variant?: 'verbal' | 'nonverbal';
  delayMs?: number;
}

const FeedbackReveal = ({ title, content, variant = 'verbal', delayMs = 0 }: FeedbackRevealProps) => {
  const [visible, setVisible] = useState(false);
  const sections = parseFeedbackSections(content);

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  const blocks = [
    {
      key: 'strengths',
      label: 'Strengths',
      icon: CheckCircle2,
      items: sections.strengths,
      accent: 'text-green-400 border-green-500/30 bg-green-500/10',
    },
    {
      key: 'improvements',
      label: 'Areas to improve',
      icon: AlertTriangle,
      items: sections.improvements,
      accent: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
    },
    {
      key: 'other',
      label: 'Insights',
      icon: Lightbulb,
      items: sections.other,
      accent: 'text-brand border-brand-border bg-brand-muted',
    },
  ].filter((b) => b.items.length > 0);

  const titleClass = variant === 'nonverbal' ? 'text-purple-300' : 'text-brand';
  const borderClass = variant === 'nonverbal' ? 'border-purple-400/40' : '';

  return (
    <Card
      variant="ghost"
      padding="md"
      className={cn(
        'mb-6 transition-all duration-700',
        borderClass,
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      <h3 className={cn('text-lg font-semibold mb-4', titleClass)}>{title}</h3>

      {blocks.length > 1 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map((block) => (
            <div key={block.key} className={cn('rounded-xl border p-4', block.accent)}>
              <div className="flex items-center gap-2 mb-3">
                <block.icon className="w-4 h-4 shrink-0" />
                <span className="text-sm font-semibold">{block.label}</span>
              </div>
              <ul className="space-y-2">
                {block.items.map((item, i) => (
                  <li key={i} className="text-gray-200 text-sm leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-200 leading-relaxed whitespace-pre-line text-sm">{content}</p>
      )}
    </Card>
  );
};

export default FeedbackReveal;
