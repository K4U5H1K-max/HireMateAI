import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/cn';

export interface HexMetric {
  label: string;
  value: number | undefined;
}

interface HexagonalAnalyticsProps {
  axes?: HexMetric[];
  className?: string;
}

type HexCardMetric = HexMetric & {
  color: string;
  score: number;
  status: string;
};

const clampScore = (value: number | undefined) => Math.min(Math.max((value ?? 0) / 10, 0), 1);

const getStatus = (score: number) => {
  if (score >= 8) return 'Strong';
  if (score >= 6) return 'Improving';
  if (score >= 4) return 'Average';
  return 'Needs Work';
};

const HexagonalAnalytics = ({ axes = [], className }: HexagonalAnalyticsProps) => {
  const [progress, setProgress] = useState(0);
  const normalizedAxes = axes.filter((axis) => axis.label).slice(0, 4);
  const signature = normalizedAxes.map((axis) => `${axis.label}:${axis.value ?? 'na'}`).join('|');

  const metrics = useMemo<HexCardMetric[]>(() => {
    const palette = ['#00F5D4', '#00B7FF', '#2AF598', '#B86BFF'];
    return normalizedAxes.map((axis, index) => {
      const score = axis.value ?? 0;
      return {
        ...axis,
        color: palette[index % palette.length],
        score,
        status: getStatus(score),
      };
    });
  }, [normalizedAxes]);

  useEffect(() => {
    if (!metrics.length) {
      setProgress(0);
      return;
    }

    setProgress(0);
    const delay = window.setTimeout(() => {
      let start: number | null = null;
      const duration = 1050;

      const step = (now: number) => {
        if (start == null) start = now;
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setProgress(eased);

        if (p < 1) requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    }, 140);

    return () => clearTimeout(delay);
  }, [signature, metrics.length]);

  if (!metrics.length) return null;

  const overall = metrics.length
    ? Number((metrics.reduce((sum, metric) => sum + metric.score, 0) / metrics.length).toFixed(1))
    : 0;

  const getGlow = (color: string, intensity: number) =>
    `0 0 ${Math.round(11 + intensity * 14)}px ${color}66, 0 0 ${Math.round(24 + intensity * 20)}px ${color}2A, 0 0 ${Math.round(38 + intensity * 24)}px ${color}10`;

  const getFieldGradient = (color: string) =>
    `radial-gradient(circle at 50% 36%, ${color}55 0%, ${color}26 28%, rgba(5, 10, 20, 0.14) 58%, rgba(2, 6, 23, 0.02) 100%)`;

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-3xl border border-cyan-400/15 bg-[radial-gradient(circle_at_top,rgba(5,252,211,0.12),rgba(3,7,18,0.97)_58%)] p-5 shadow-[0_0_0_1px_rgba(5,252,211,0.04),0_24px_56px_rgba(0,0,0,0.46)] sm:p-6 lg:p-7',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0,transparent_24%,transparent_76%,rgba(5,252,211,0.05)_100%)] opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,252,211,0.05)_1px,transparent_1px),linear-gradient(rgba(5,252,211,0.05)_1px,transparent_1px)] bg-[size:24px_24px] opacity-20" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(5,252,211,0.07),transparent_44%)] opacity-65" />

      <div className="relative flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:gap-5">
          {metrics.map((metric, index) => {
            const normalized = clampScore(metric.value) * progress;
            const hexClip = 'polygon(25% 4%, 75% 4%, 96% 50%, 75% 96%, 25% 96%, 4% 50%)';
            const innerClip = 'polygon(25% 6%, 75% 6%, 94% 50%, 75% 94%, 25% 94%, 6% 50%)';
            const coreClip = 'polygon(31% 13%, 69% 13%, 88% 50%, 69% 87%, 31% 87%, 12% 50%)';
            const glowClip = 'polygon(21% 2%, 79% 2%, 100% 50%, 79% 98%, 21% 98%, 0% 50%)';

            return (
              <div
                key={metric.label}
                className="group relative min-h-[250px] transition-transform duration-300 hover:-translate-y-1"
                style={{ transitionDelay: `${index * 70}ms` }}
              >
                <div
                  className="absolute inset-0 rounded-[30px] border border-white/10 bg-cyan-500/5 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100"
                  style={{ boxShadow: getGlow(metric.color, normalized) }}
                />

                <div
                  className="relative h-full overflow-hidden rounded-[30px] border border-white/10 bg-slate-950/64 p-4 transition-all duration-300 group-hover:border-white/20 group-hover:bg-slate-950/80 sm:p-5"
                  style={{ boxShadow: getGlow(metric.color, normalized) }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-65 animate-neonPulse"
                    style={{
                      clipPath: glowClip,
                      background: `radial-gradient(circle at 50% 42%, ${metric.color}14 0%, rgba(2,6,23,0.08) 60%, rgba(2,6,23,0) 100%)`,
                      filter: 'saturate(1.05)',
                    }}
                  />

                  <div
                    className="absolute inset-0 opacity-100"
                    style={{
                      clipPath: hexClip,
                      background: `linear-gradient(180deg, ${metric.color}20 0%, rgba(3,7,18,0.22) 52%, rgba(2,6,23,0.97) 100%)`,
                    }}
                  />

                  <div className="absolute inset-0" style={{ clipPath: hexClip }}>
                    <div className="absolute inset-x-0 bottom-0 h-full">
                      <div
                        className="absolute inset-x-[11%] top-[12%] h-[56%] rounded-[32px] opacity-55 blur-md animate-neonPulse"
                        style={{
                          clipPath: innerClip,
                          background: getFieldGradient(metric.color),
                        }}
                      />

                      <div
                        className="absolute inset-x-[8%] bottom-0 rounded-none transition-[height,opacity] duration-1000 ease-out"
                        style={{
                          height: `${Math.max(18, normalized * 100)}%`,
                          opacity: 0.24 + normalized * 0.42,
                          clipPath: innerClip,
                          background: `linear-gradient(180deg, ${metric.color}D8 0%, ${metric.color}86 42%, ${metric.color}18 100%)`,
                          boxShadow: `inset 0 0 18px ${metric.color}44, 0 0 18px ${metric.color}18`,
                        }}
                      />

                      <div
                        className="absolute inset-x-[18%] top-[20%] h-[24%] rounded-[28px] opacity-70 mix-blend-screen"
                        style={{
                          clipPath: coreClip,
                          background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.28) 0%, ${metric.color}42 34%, rgba(255,255,255,0.01) 72%)`,
                          boxShadow: `inset 0 0 14px rgba(255,255,255,0.12), 0 0 16px ${metric.color}28`,
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className="pointer-events-none absolute inset-x-[12%] top-[14%] h-[48%] rounded-[28px] border border-white/12 opacity-55"
                    style={{
                      clipPath: innerClip,
                      boxShadow: `inset 0 0 18px ${metric.color}18, 0 0 18px ${metric.color}0E`,
                    }}
                  />

                  <div className="relative z-10 flex h-full min-h-[220px] flex-col items-center justify-between py-2 text-center">
                    <div className="flex w-full flex-col items-center gap-3">
                      <div
                        className="h-3.5 w-3.5 rounded-full border border-white/25 shadow-[0_0_18px_rgba(5,252,211,0.45)] animate-neonPulse"
                        style={{ backgroundColor: metric.color, boxShadow: getGlow(metric.color, normalized) }}
                      />
                      <div className="space-y-1 rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-2 shadow-[inset_0_0_18px_rgba(0,0,0,0.22)] backdrop-blur-[2px]">
                        <h4 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-50 sm:text-xs">
                          {metric.label}
                        </h4>
                        <p className="text-3xl font-bold tabular-nums text-cyan-50 sm:text-[2rem] drop-shadow-[0_0_10px_rgba(255,255,255,0.12)]">
                          {metric.score.toFixed(1)}
                          <span className="ml-1 text-sm font-medium text-slate-200/90">/10</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex w-full flex-col items-center gap-2">
                      <span
                        className="inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase text-white/95 backdrop-blur-sm"
                        style={{
                          borderColor: `${metric.color}55`,
                          backgroundColor: `${metric.color}14`,
                          boxShadow: getGlow(metric.color, normalized),
                        }}
                      >
                        {metric.status}
                      </span>

                      <div className="w-full max-w-[180px] rounded-full bg-white/5 p-1 shadow-[inset_0_0_18px_rgba(255,255,255,0.04)]">
                        <div
                          className="h-2 rounded-full transition-[width,box-shadow] duration-1000 ease-out"
                          style={{
                            width: `${Math.max(12, normalized * 100)}%`,
                            background: `linear-gradient(90deg, ${metric.color} 0%, ${metric.color}ff 55%, rgba(255,255,255,0.8) 100%)`,
                            boxShadow: getGlow(metric.color, normalized),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-cyan-400/10 bg-slate-950/42 px-4 py-4 text-center shadow-[inset_0_0_24px_rgba(5,252,211,0.08),0_0_24px_rgba(5,252,211,0.05)]">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Overall Performance</p>
          <p className="mt-2 text-4xl font-bold tabular-nums text-cyan-100 drop-shadow-[0_0_18px_rgba(5,252,211,0.18)]">{overall.toFixed(1)}</p>
          <p className="text-sm text-gray-500">Average score across completed interviews</p>
        </div>
      </div>
    </div>
  );
};

export default HexagonalAnalytics;