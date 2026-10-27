import { cn } from "../../../shared/utils/ui";

interface QuizNavButtonsProps {
  totalQuestions: number;
  currentIndex: number;
  answered: Set<string>;
  questionOrder: string[];
  onGoTo: (index: number) => void;
}

export function QuizNavButtons({
  totalQuestions,
  currentIndex,
  answered,
  questionOrder,
  onGoTo,
}: QuizNavButtonsProps) {
  return (
    <div className="bg-white border border-brand-100 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Question Navigator
      </h3>
      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
        {Array.from({ length: totalQuestions }, (_, i) => {
          const qId = questionOrder[i];
          const isAnswered = qId ? answered.has(qId) : false;
          const isCurrent = i === currentIndex;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onGoTo(i)}
              className={cn(
                "h-9 w-full text-sm font-medium rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-1",
                isCurrent
                  ? "bg-amber-500 text-white ring-2 ring-amber-300 focus:ring-amber-400"
                  : isAnswered
                  ? "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-400"
                  : "bg-brand-50 text-slate-600 hover:bg-slate-200 focus:ring-brand-300"
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-amber-500 inline-block" />
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-brand-600 inline-block" />
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-slate-200 inline-block" />
          <span>Unanswered</span>
        </div>
      </div>
    </div>
  );
}
