import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';

export interface RadarAxis {
  label: string;
  value: number | undefined;
}

interface ScoreRadarChartProps {
  axes: RadarAxis[];
  className?: string;
  size?: number;
}

const ScoreRadarChart = ({ axes, className, size = 280 }: ScoreRadarChartProps) => {
  const [progress, setProgress] = useState(0);
  const validAxes = axes.filter((a) => a.value != null) as { label: string; value: number }[];

  useEffect(() => {
    const delay = window.setTimeout(() => {
      let start: number | null = null;
      const duration = 900;
      const step = (now: number) => {
        if (start == null) start = now;
        const p = Math.min((now - start) / duration, 1);
        setProgress(1 - Math.pow(1 - p, 3));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, 500);
    return () => clearTimeout(delay);
  }, [axes]);

  if (validAxes.length < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.34;
  const levels = [0.25, 0.5, 0.75, 1];

  const angleStep = (2 * Math.PI) / validAxes.length;
  const startAngle = -Math.PI / 2;

  const pointAt = (index: number, scale: number) => {
    const angle = startAngle + index * angleStep;
    const r = maxR * scale;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const dataPoints = validAxes.map((axis, i) => {
    const v = Math.min(Math.max(axis.value / 10, 0), 1) * progress;
    return pointAt(i, v);
  });

  const polygon = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className={cn('relative', className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
        {levels.map((level) => {
          const gridPoints = validAxes.map((_, i) => pointAt(i, level));
          const pts = gridPoints.map((p) => `${p.x},${p.y}`).join(' ');
          return (
            <polygon
              key={level}
              points={pts}
              fill="none"
              stroke="rgba(5, 252, 211, 0.12)"
              strokeWidth={1}
            />
          );
        })}

        {validAxes.map((_, i) => {
          const end = pointAt(i, 1);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke="rgba(5, 252, 211, 0.15)"
              strokeWidth={1}
            />
          );
        })}

        <polygon
          points={polygon}
          fill="rgba(5, 252, 211, 0.2)"
          stroke="#05fcd3"
          strokeWidth={2}
          className="drop-shadow-[0_0_16px_rgba(5,252,211,0.35)]"
        />

        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="#05fcd3" className="opacity-90" />
        ))}
      </svg>

      <div className="absolute inset-0 pointer-events-none">
        {validAxes.map((axis, i) => {
          const labelPos = pointAt(i, 1.22);
          return (
            <span
              key={axis.label}
              className="absolute text-[10px] sm:text-xs text-gray-400 font-medium -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
              style={{ left: labelPos.x, top: labelPos.y }}
            >
              {axis.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default ScoreRadarChart;
