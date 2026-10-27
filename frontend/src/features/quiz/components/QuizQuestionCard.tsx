import { cn } from "../../../shared/utils/ui";

export interface DisplayOption {
  key: "A" | "B" | "C" | "D";
  displayLabel: "A" | "B" | "C" | "D";
  text: string;
}

interface QuizQuestionCardProps {
  questionIndex: number;
  totalQuestions: number;
  questionText: string;
  options: DisplayOption[];
  selectedKey: "A" | "B" | "C" | "D" | null;
  onSelect: (key: "A" | "B" | "C" | "D") => void;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export function QuizQuestionCard({
  questionIndex,
  totalQuestions,
  questionText,
  options,
  selectedKey,
  onSelect,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
}: QuizQuestionCardProps) {
  const progressPct = ((questionIndex + 1) / totalQuestions) * 100;

  return (
    <div className="bg-white border border-brand-100 rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-900">
            Question {questionIndex + 1} / {totalQuestions}
          </span>
          {selectedKey && (
            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
              Answered
            </span>
          )}
        </div>
        <div className="w-32 sm:w-48 h-2 bg-brand-50 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-600 transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="px-6 py-6 sm:px-8 sm:py-8">
        <h3 className="text-lg sm:text-xl font-semibold text-slate-900 leading-relaxed whitespace-pre-wrap">
          {questionText}
        </h3>

        <div className="mt-6 space-y-3">
          {options.map((opt) => {
            const isSelected = selectedKey === opt.key;
            return (
              <label
                key={opt.displayLabel}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all group",
                  isSelected
                    ? "border-brand-600 bg-brand-50"
                    : "border-brand-100 hover:border-slate-300 hover:bg-brand-50"
                )}
              >
                <input
                  type="radio"
                  name={`question-${questionIndex}`}
                  value={opt.key}
                  checked={isSelected}
                  onChange={() => onSelect(opt.key)}
                  className="mt-1 h-4 w-4 text-brand-600 border-slate-300 focus:ring-brand-400"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-bold flex-shrink-0 mt-0.5",
                        isSelected
                          ? "bg-brand-600 text-white"
                          : "bg-brand-50 text-slate-600 group-hover:bg-slate-200"
                      )}
                    >
                      {opt.displayLabel}
                    </span>
                    <span className="text-sm sm:text-base text-slate-800 leading-relaxed whitespace-pre-wrap pt-1">
                      {opt.text}
                    </span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canGoPrev}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1",
            canGoPrev
              ? "text-slate-700 bg-brand-50 hover:bg-slate-200 focus:ring-brand-300"
              : "text-slate-300 bg-brand-50 cursor-not-allowed"
          )}
        >
          ← Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1",
            canGoNext
              ? "text-white bg-brand-600 hover:bg-brand-700 focus:ring-slate-600"
              : "text-slate-300 bg-brand-50 cursor-not-allowed"
          )}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
