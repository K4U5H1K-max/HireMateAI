import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/cn';

export interface PerformanceAxis {
  label: string;
  value: number | undefined;
}

interface PerformanceEqualizerProps {
  axes?: PerformanceAxis[];
  className?: string;
}

type ArcMetric = PerformanceAxis & {
  color: string;
  score: number;
};

const clampScore = (value: number | undefined) => Math.min(Math.max((value ?? 0) / 10, 0), 1);

const TAU = Math.PI * 2;
const START_ANGLE = -Math.PI / 2;
const SEGMENT_GAP = Math.PI * 0.09;

const PerformanceEqualizer = ({ axes = [], className }: PerformanceEqualizerProps) => {
  const [progress, setProgress] = useState(0);
  const normalizedAxes = axes.filter((axis) => axis.label).slice(0, 4);
  const signature = normalizedAxes.map((axis) => `${axis.label}:${axis.value ?? 'na'}`).join('|');

  const metrics = useMemo<ArcMetric[]>(() => {
    const palette = ['#00F5D4', '#00BBF9', '#06D6A0', '#9B5DE5'];
    return normalizedAxes.map((axis, index) => ({
      ...axis,
      color: palette[index % palette.length],
      score: axis.value ?? 0,
    }));
  }, [normalizedAxes]);

  useEffect(() => {
    if (!metrics.length) {
      setProgress(0);
      return;
    }

    setProgress(0);
    const delay = window.setTimeout(() => {
      let start: number | null = null;
      const duration = 1100;

      const step = (now: number) => {
        if (start == null) start = now;
        const p = Math.min((now - start) / duration, 1);
        setProgress(1 - Math.pow(1 - p, 3));
        if (p < 1) requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    }, 150);

    return () => clearTimeout(delay);
  }, [signature, metrics.length]);

  if (!metrics.length) return null;

  const size = 340;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 118;
  const strokeWidth = 22;
  const segmentAngle = TAU / metrics.length;

  const polarToCartesian = (angle: number, r: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const arcPath = (startAngle: number, endAngle: number, r: number) => {
    const start = polarToCartesian(startAngle, r);
    const end = polarToCartesian(endAngle, r);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  const avgScore = metrics.length
    ? Number((metrics.reduce((sum, metric) => sum + metric.score, 0) / metrics.length).toFixed(1))
    : 0;

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-2xl border border-cyan-400/15 bg-[radial-gradient(circle_at_top,rgba(5,252,211,0.12),rgba(3,7,18,0.92)_60%)] p-5 shadow-[0_0_0_1px_rgba(5,252,211,0.04),0_24px_60px_rgba(0,0,0,0.45)] sm:p-6 lg:p-7',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0,transparent_24%,transparent_76%,rgba(5,252,211,0.05)_100%)] opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,252,211,0.05)_1px,transparent_1px),linear-gradient(rgba(5,252,211,0.05)_1px,transparent_1px)] bg-[size:24px_24px] opacity-20" />

      <div className="relative flex flex-col items-center gap-5">
        <div className="relative w-full max-w-[360px] sm:max-w-[400px]">
          <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full overflow-visible">
            <defs>
              {metrics.map((metric) => {
                const gradientId = `perf-gradient-${metric.label.replace(/\s+/g, '-').toLowerCase()}`;
                return (
                  <linearGradient key={gradientId} id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={metric.color} stopOpacity="1" />
                    <stop offset="100%" stopColor={metric.color} stopOpacity="0.45" />
                  </linearGradient>
                );
              })}
              <filter id="perf-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="1 0 0 0 0
                          0 1 0 0 0
                          0 0 1 0 0
                          0 0 0 18 -6"
                  result="glow"
                />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {metrics.map((metric, index) => {
              const segmentStart = START_ANGLE + index * segmentAngle + SEGMENT_GAP / 2;
              const segmentEnd = START_ANGLE + (index + 1) * segmentAngle - SEGMENT_GAP / 2;
              const normalized = clampScore(metric.value) * progress;
              const fillEnd = segmentStart + (segmentEnd - segmentStart) * normalized;
              const gradientId = `perf-gradient-${metric.label.replace(/\s+/g, '-').toLowerCase()}`;

              return (
                <g key={metric.label}>
                  <path
                    d={arcPath(segmentStart, segmentEnd, radius)}
                    fill="none"
                    stroke="rgba(148,163,184,0.12)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                  />
                  <path
                    d={arcPath(segmentStart, fillEnd, radius)}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    filter="url(#perf-glow)"
                    style={{
                      opacity: 0.8 + normalized * 0.2,
                    }}
                  />
                  <circle
                    cx={polarToCartesian(fillEnd, radius).x}
                    cy={polarToCartesian(fillEnd, radius).y}
                    r={strokeWidth / 2.6}
                    fill={metric.color}
                    filter="url(#perf-glow)"
                    opacity={0.9}
                  />
                </g>
              );
            })}

            <circle
              cx={cx}
              cy={cy}
              r={82}
              fill="rgba(2,6,23,0.94)"
              stroke="rgba(5,252,211,0.16)"
              strokeWidth="1.5"
            />
            <circle
              cx={cx}
              cy={cy}
              r={72}
              fill="none"
              stroke="rgba(5,252,211,0.08)"
              strokeDasharray="4 9"
            />

            <text x={cx} y={cy - 8} textAnchor="middle" className="fill-white text-[13px] font-semibold tracking-[0.24em] uppercase">
              AI Performance
            </text>
            <text x={cx} y={cy + 20} textAnchor="middle" className="fill-cyan-100 text-[30px] font-bold tabular-nums">
              {avgScore.toFixed(1)}
            </text>
            <text x={cx} y={cy + 40} textAnchor="middle" className="fill-slate-400 text-[11px] font-medium tracking-[0.3em] uppercase">
              Overall Score /10
            </text>
          </svg>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className="group rounded-2xl border border-cyan-400/10 bg-slate-950/45 px-3 py-3 text-center transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-cyan-500/5 hover:shadow-[0_0_24px_rgba(5,252,211,0.12)] sm:px-4"
            >
              <div
                className="mx-auto mb-2 h-2.5 w-2.5 rounded-full shadow-[0_0_16px_rgba(5,252,211,0.4)]"
                style={{ backgroundColor: metric.color }}
              />
              <p className="min-h-[2.25rem] text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100/80 leading-tight sm:text-[11px] sm:tracking-[0.14em] whitespace-normal break-words">
                {metric.label}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-white">
                {metric.score.toFixed(1)}/10
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PerformanceEqualizer;