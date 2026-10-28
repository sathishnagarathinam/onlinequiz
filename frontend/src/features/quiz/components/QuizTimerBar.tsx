import { cn } from "../../../shared/utils/ui";

interface QuizTimerBarProps {
  quizTitle: string;
  formatted: string;
  progressPct: number;
  remainingSeconds: number;
  onSubmit: () => void;
  submitting?: boolean;
}

export function QuizTimerBar({
  quizTitle,
  formatted,
  progressPct,
  remainingSeconds,
  onSubmit,
  submitting,
}: QuizTimerBarProps) {
  const isUrgent = remainingSeconds < 300;

  return (
    <div className="sticky top-0 z-50 w-full bg-brand-700 text-white px-3 sm:px-4 py-2 flex items-center gap-3 shadow-lg">
      <div className="flex-1 min-w-0">
        <h2 className="text-xs sm:text-sm font-semibold truncate">{quizTitle}</h2>
      </div>

      <div className="flex flex-col items-center shrink-0">
        <span
          className={cn(
            "text-lg sm:text-2xl font-bold tabular-nums leading-none",
            isUrgent && "text-red-500 animate-pulse"
          )}
        >
          {formatted}
        </span>
        <div className="w-20 sm:w-40 h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-1000 ease-linear rounded-full",
              isUrgent ? "bg-red-500" : "bg-emerald-400"
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="shrink-0">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className={cn(
            "px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900",
            submitting
              ? "bg-slate-600 text-slate-300 cursor-not-allowed"
              : "bg-amber-500 text-slate-900 hover:bg-amber-400 focus:ring-amber-400 active:bg-amber-600"
          )}
        >
          {submitting ? "Submitting..." : "Submit Quiz"}
        </button>
      </div>
    </div>
  );
}
