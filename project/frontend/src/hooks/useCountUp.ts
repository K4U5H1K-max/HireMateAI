import { useEffect, useState } from 'react';

/** Ease-out cubic: fast start, smooth settle (good for score reveals). */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates a number from 0 to `target` when `active` becomes true.
 * Returns the current display value for binding to UI.
 */
export function useCountUp(
  target: number | undefined | null,
  options: { duration?: number; active?: boolean; decimals?: number } = {}
) {
  const { duration = 1200, active = true, decimals = 1 } = options;
  const [value, setValue] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active || target == null || Number.isNaN(target)) {
      setValue(0);
      setDone(false);
      return;
    }

    setDone(false);
    let frameId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setValue(target * eased);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setValue(target);
        setDone(true);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration, active]);

  const display =
    target == null
      ? 'N/A'
      : decimals === 0
        ? Math.round(value).toString()
        : value.toFixed(decimals);

  return { value, display, done };
}
