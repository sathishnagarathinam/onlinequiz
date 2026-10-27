import type { Question } from "../../../shared/types/firestore";
import { cn } from "../../../shared/utils/ui";

type AnswerKey = "A" | "B" | "C" | "D" | null;

const OPTION_KEYS: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];

const OPTION_FIELD: Record<"A" | "B" | "C" | "D", keyof Question> = {
  A: "optionA",
  B: "optionB",
  C: "optionC",
  D: "optionD",
};

interface QuizReviewListProps {
  /** Questions in the same order the employee saw them. */
  questions: Question[];
  answers: Record<string, AnswerKey>;
}

/**
 * Per-question review shown to an employee only after results are published.
 * Reveals the correct answer and the question's explanation.
 */
export function QuizReviewList({ questions, answers }: QuizReviewListProps) {
  return (
    <div className="space-y-4">
      {questions.map((q, idx) => {
        const picked: AnswerKey = q.id ? answers[q.id] ?? null : null;
        const isSkipped = picked === null;
        const isCorrect = !isSkipped && picked === q.correctAnswer;

        const statusLabel = isSkipped
          ? "Skipped"
          : isCorrect
          ? "Correct"
          : "Wrong";
        const statusClass = isSkipped
          ? "bg-slate-200 text-slate-700"
          : isCorrect
          ? "bg-emerald-100 text-emerald-700"
          : "bg-red-100 text-red-700";

        return (
          <div
            key={q.id ?? idx}
            className="bg-white border border-brand-100 rounded-lg"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-slate-900">
                Question {idx + 1}
              </span>
              <span
                className={cn(
                  "px-2.5 py-0.5 text-xs font-semibold rounded-full",
                  statusClass
                )}
              >
                {statusLabel}
              </span>
            </div>

            <div className="px-6 py-5">
              <p className="text-base font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                {q.question}
              </p>

              <div className="mt-4 space-y-2">
                {OPTION_KEYS.map((key) => {
                  const isAnswer = key === q.correctAnswer;
                  const isPicked = key === picked;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 rounded-lg border",
                        isAnswer
                          ? "border-emerald-300 bg-emerald-50"
                          : isPicked
                          ? "border-red-300 bg-red-50"
                          : "border-slate-200 bg-white"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0",
                          isAnswer
                            ? "bg-emerald-600 text-white"
                            : isPicked
                            ? "bg-red-600 text-white"
                            : "bg-brand-50 text-slate-600"
                        )}
                      >
                        {key}
                      </span>
                      <span className="flex-1 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {String(q[OPTION_FIELD[key]] ?? "")}
                      </span>
                      {isAnswer && (
                        <span className="shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-100 text-emerald-700">
                          {isPicked ? "Your answer · Correct" : "Correct answer"}
                        </span>
                      )}
                      {isPicked && !isAnswer && (
                        <span className="shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded bg-red-100 text-red-700">
                          Your answer
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Explanation
                </div>
                {q.explanation ? (
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {q.explanation}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    No explanation provided for this question.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
