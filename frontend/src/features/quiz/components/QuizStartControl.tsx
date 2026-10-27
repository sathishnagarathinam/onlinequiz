import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import { cn } from "../../../shared/utils/ui";

/** Whole seconds from nowMs until a Firestore timestamp; 0 when missing or past. */
function secondsUntil(at: unknown, nowMs: number): number {
  if (at instanceof Timestamp) {
    const deltaMs = at.toDate().getTime() - nowMs;
    return Math.max(0, Math.ceil(deltaMs / 1000));
  }
  return 0;
}

/** Minutes:seconds below an hour (e.g. "4:00"), hours:minutes:seconds above. */
function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

const secondaryButton =
  "block w-full text-center px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300 transition-colors";

const primaryButton =
  "block w-full text-center px-3 py-2 text-xs font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 transition-colors";

interface QuizStartControlProps {
  quizId: string;
  openTime: unknown;
  /** True once the employee has submitted this quiz. */
  attempted?: boolean;
  /** Result document id, present once the attempt has been evaluated. */
  resultId?: string | null;
  /** Whether the result is visible (published manually or by schedule). */
  resultPublished?: boolean;
  /** Scheduled auto-publish time for the results. */
  resultPublishAt?: unknown;
}

/**
 * Quiz card footer:
 *  - not attempted, window not open yet -> "Quiz starts in 4:00 min" countdown
 *  - not attempted, window open         -> Start Quiz
 *  - attempted, result visible          -> "Results published" + See the Results / Check Rank
 *  - attempted, publish time scheduled  -> live countdown button -> result page
 *  - attempted, nothing published yet   -> "Results not published" + Check Results / Check Rank
 */
export function QuizStartControl({
  quizId,
  openTime,
  attempted = false,
  resultId = null,
  resultPublished = false,
  resultPublishAt,
}: QuizStartControlProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Tick only while a countdown is actually on screen (quiz start or publish).
  useEffect(() => {
    const openRemaining = secondsUntil(openTime, Date.now());
    const publishRemaining =
      attempted && !resultPublished ? secondsUntil(resultPublishAt, Date.now()) : 0;
    if (openRemaining <= 0 && publishRemaining <= 0) return;

    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [openTime, resultPublishAt, attempted, resultPublished]);

  if (attempted) {
    const publishRemaining = resultPublished
      ? 0
      : secondsUntil(resultPublishAt, nowMs);
    const publishCountdown = publishRemaining > 0;

    // Nothing to show until the attempt has been scored, so the pill must not
    // claim "Results published" while the result document is still missing.
    const status = !resultId
      ? { label: "Preparing your result…", ok: false, pulse: true }
      : resultPublished
      ? { label: "Results published", ok: true, pulse: false }
      : publishCountdown
      ? {
          label: `Results in ${formatCountdown(publishRemaining)} min`,
          ok: false,
          pulse: true,
        }
      : { label: "Results not published", ok: false, pulse: true };

    return (
      <div className="space-y-2">
        <div
          className={
            status.ok
              ? "w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md"
              : "w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md"
          }
        >
          <span
            className={
              status.ok
                ? "h-1.5 w-1.5 rounded-full bg-emerald-500"
                : cn(
                    "h-1.5 w-1.5 rounded-full bg-amber-500",
                    status.pulse && "animate-pulse"
                  )
            }
          />
          {status.label}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {resultId ? (
            <Link to={`/employee/results/${resultId}`} className={primaryButton}>
              {resultPublished
                ? "See the Results"
                : publishCountdown
                ? `Results in ${formatCountdown(publishRemaining)}`
                : "Check Results"}
            </Link>
          ) : (
            <Link
              to={`/employee/pending-results/${quizId}`}
              className={secondaryButton}
            >
              Preparing Result
            </Link>
          )}
          <Link to={`/employee/ranks/${quizId}`} className={secondaryButton}>
            Check Rank
          </Link>
        </div>
      </div>
    );
  }

  const remaining = secondsUntil(openTime, nowMs);

  if (remaining > 0) {
    return (
      <div className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-brand-800 bg-brand-50 border border-brand-200 rounded-md">
        <svg
          className="h-3.5 w-3.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Quiz starts in {formatCountdown(remaining)} min
      </div>
    );
  }

  return (
    <Link to={`/employee/quiz/${quizId}`} className={primaryButton}>
      Start Quiz
    </Link>
  );
}
