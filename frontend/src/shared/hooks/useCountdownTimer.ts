import { useEffect, useRef, useState, useCallback } from "react";

interface UseCountdownTimerOptions {
  initialSeconds: number;
  onExpire?: () => void;
  autoStart?: boolean;
}

interface UseCountdownTimerReturn {
  remainingSeconds: number;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: (newSeconds?: number) => void;
  formatted: string;
  progressPct: number;
}

export function useCountdownTimer(
  opts: UseCountdownTimerOptions
): UseCountdownTimerReturn {
  const { initialSeconds, onExpire, autoStart = true } = opts;
  const [remaining, setRemaining] = useState(initialSeconds);
  const [running, setRunning] = useState(autoStart);
  const tickRef = useRef<number | null>(null);
  const expiredRef = useRef(false);
  const totalRef = useRef(initialSeconds);

  const fireExpire = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    setRunning(false);
    onExpire?.();
  }, [onExpire]);

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(tickRef.current!);
          fireExpire();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [running, fireExpire]);

  const start = useCallback(() => {
    expiredRef.current = false;
    setRunning(true);
  }, []);

  const pause = useCallback(() => setRunning(false), []);

  const reset = useCallback((newSec?: number) => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    const val = typeof newSec === "number" ? newSec : initialSeconds;
    totalRef.current = val;
    setRemaining(val);
    expiredRef.current = false;
    setRunning(false);
  }, [initialSeconds]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const formatted =
    (h > 0 ? `${String(h).padStart(2, "0")}:` : "") +
    `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  const progressPct =
    totalRef.current > 0 ? Math.max(0, (remaining / totalRef.current) * 100) : 0;

  return {
    remainingSeconds: remaining,
    isRunning: running,
    start,
    pause,
    reset,
    formatted,
    progressPct,
  };
}
