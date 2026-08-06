import { useEffect, useRef, useCallback } from 'react';

interface UseJobPollerOptions {
  enabled: boolean;
  intervalMs?: number;
  tick: () => Promise<void>;
}

/**
 * Polls on an interval while `enabled` is true. `tick` runs immediately on
 * start and then every `intervalMs`. The caller closes over its own job id.
 * Returns a `stop` function that clears the timer without relying on the
 * effect cleanup.
 */
export function useJobPoller({ enabled, intervalMs = 2500, tick }: UseJobPollerOptions) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef(tick);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    tickRef.current().catch(() => {});
    timerRef.current = setInterval(() => {
      tickRef.current().catch(() => {});
    }, intervalMs);

    return stop;
  }, [enabled, intervalMs, stop]);

  return { stop };
}
