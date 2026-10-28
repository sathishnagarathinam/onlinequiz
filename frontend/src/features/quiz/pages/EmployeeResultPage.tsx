import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useRequireRole } from "../../../shared/hooks/useAuthState";
import {
  getResult,
  getAttempt,
  getQuiz,
  listQuestions,
} from "../../../shared/services/firestoreApi";
import { pickQuestionIds } from "../../../shared/utils/shuffle";
import type { Question, Quiz, Result } from "../../../shared/types/firestore";
import { cn, formatSeconds, formatTimestamp } from "../../../shared/utils/ui";
import { isResultVisible } from "../../../shared/utils/publish";
import { EmployeeShell } from "../../auth/components/EmployeeShell";
import { QuizReviewList } from "../components/QuizReviewList";

type AnswerKey = "A" | "B" | "C" | "D" | null;

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50">
      <div
        className={cn(
          "w-8 h-8 border-4 border-brand-100 border-t-slate-600 rounded-full animate-spin"
        )}
      />
    </div>
  );
}

export function EmployeeResultPage() {
  const { resultId = "" } = useParams<{ resultId: string }>();
  const { allowed, loading: authLoading, dbUser } = useRequireRole("employee");

  const [result, setResult] = useState<Result | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<Question[] | null>(null);
  const [reviewAnswers, setReviewAnswers] = useState<Record<string, AnswerKey>>({});

  useEffect(() => {
    if (authLoading || !allowed || !resultId) return;
    let cancelled = false;

    getResult(resultId)
      .then(async (r) => {
        if (cancelled) return;
        if (!r) {
          setError("Result not found");
          return;
        }
        setResult(r);
        // The quiz carries the scheduled result-publish time, so load it to
        // decide whether the result is visible yet.
        const q = await getQuiz(r.quizId);
        if (!cancelled) setQuiz(q);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load result");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, allowed, resultId]);

  // True when the admin published manually OR the scheduled time has passed.
  // The tick makes the page flip to the result by itself at the scheduled time.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const resultVisible = isResultVisible(result, quiz, nowMs);
  useEffect(() => {
    if (!result || resultVisible) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [result, resultVisible]);

  // Rebuild the question set and order the employee actually saw, so the review
  // matches their attempt. Loaded only once the result is visible.
  useEffect(() => {
    if (!result || !resultVisible) return;
    let cancelled = false;

    const loadReview = async () => {
      try {
        const [attempt, questions] = await Promise.all([
          getAttempt(result.attemptId),
          listQuestions(result.quizId),
        ]);
        if (cancelled || !attempt) return;

        const withIds = questions.filter((q) => q.id);
        const byId = new Map(withIds.map((q) => [q.id!, q] as const));
        // The attempt stores exactly what it showed. Attempts made before that
        // was stored are rebuilt from the same seed shuffle.
        const ids = attempt.questionIds?.length
          ? attempt.questionIds
          : pickQuestionIds(
              withIds.map((q) => q.id!),
              attempt.seed,
              quiz?.numQuestionsToShow ?? withIds.length
            );
        const ordered = ids
          .map((id) => byId.get(id))
          .filter((q): q is Question => q !== undefined);

        setReviewQuestions(ordered);
        setReviewAnswers(attempt.answers ?? {});
      } catch (e) {
        console.warn("[result] could not load question review", e);
      }
    };

    void loadReview();

    return () => {
      cancelled = true;
    };
  }, [result, resultVisible]);

  if (authLoading || !allowed) return null;

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-lg p-6">
          <div className="text-red-600 font-semibold mb-2">Error</div>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <Link
            to="/employee/home"
            className="inline-block px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (result && dbUser && result.uid !== dbUser.uid) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-amber-200 rounded-lg p-6">
          <div className="text-amber-600 font-semibold mb-2">Access Denied</div>
          <p className="text-sm text-slate-600">
            This result does not belong to your account.
          </p>
          <Link
            to="/employee/home"
            className="inline-block mt-4 px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (result && !resultVisible) {
    return (
      <EmployeeShell
        title="Quiz Result"
        actions={
          <div className="flex items-center gap-4">
            <Link
              to={`/employee/ranks/${result.quizId}`}
              className="text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors"
            >
              Check Rank
            </Link>
            <Link
              to="/employee/home"
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        }
      >
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="bg-white border border-amber-200 rounded-lg p-8 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
              <svg
                className="h-8 w-8 text-amber-600"
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
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Results Not Yet Published
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              Your quiz has been submitted. Results will be published by the
              administrator. Please check back later.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Awaiting publication
            </div>
          </div>
        </main>
      </EmployeeShell>
    );
  }

  return (
    <EmployeeShell
      title="Your Result"
      actions={
        <div className="flex items-center gap-4">
          <Link
            to={`/employee/ranks/${result?.quizId ?? ""}`}
            className="text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors"
          >
            Check Rank
          </Link>
          <Link
            to="/employee/home"
            className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      }
    >
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="bg-white border border-brand-100 rounded-lg p-8 text-center">
          <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-brand-50 flex items-center justify-center text-3xl font-bold text-slate-600">
            {result?.rank ? `#${result.rank}` : "-"}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Your Result
          </h2>
          <p className="text-sm text-slate-500">
            {result?.rank
              ? `Your rank for this quiz is #${result.rank}.`
              : "Rank will be shown once the rank list is published."}
          </p>

          {result && (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
              <div className="bg-brand-50 rounded-md p-4">
                <div className="text-xs text-slate-500 mb-1">Score</div>
                <div className="text-xl font-bold text-slate-900">
                  {result.score} / {result.totalMarks}
                </div>
              </div>
              <div className="bg-brand-50 rounded-md p-4">
                <div className="text-xs text-slate-500 mb-1">Percentage</div>
                <div className="text-xl font-bold text-slate-900">
                  {result.percentage.toFixed(1)}%
                </div>
              </div>
              <div className="bg-brand-50 rounded-md p-4">
                <div className="text-xs text-slate-500 mb-1">Correct</div>
                <div className="text-xl font-bold text-emerald-600">
                  {result.correctCount}
                </div>
              </div>
              <div className="bg-brand-50 rounded-md p-4">
                <div className="text-xs text-slate-500 mb-1">Wrong</div>
                <div className="text-xl font-bold text-red-600">
                  {result.wrongCount}
                </div>
              </div>
              <div className="bg-brand-50 rounded-md p-4">
                <div className="text-xs text-slate-500 mb-1">Skipped</div>
                <div className="text-xl font-bold text-slate-600">
                  {result.skippedCount}
                </div>
              </div>
              <div className="bg-brand-50 rounded-md p-4">
                <div className="text-xs text-slate-500 mb-1">Time Taken</div>
                <div className="text-xl font-bold text-slate-900">
                  {formatSeconds(result.timeTaken)}
                </div>
              </div>
              <div className="col-span-2 bg-brand-50 rounded-md p-4">
                <div className="text-xs text-slate-500 mb-1">Evaluated At</div>
                <div className="text-sm font-semibold text-slate-900">
                  {formatTimestamp(result.evaluatedAt)}
                </div>
              </div>
            </div>
          )}
        </div>

        {reviewQuestions && reviewQuestions.length > 0 && (
          <section className="mt-8">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Question Review
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Correct answers and explanations for each question
              </p>
            </div>
            <QuizReviewList
              questions={reviewQuestions}
              answers={reviewAnswers}
            />
          </section>
        )}
      </main>
    </EmployeeShell>
  );
}
