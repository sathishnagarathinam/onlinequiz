import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import { useRequireRole } from "../../../shared/hooks/useAuthState";
import { useAuthCtx } from "../context/AuthContext";
import {
  isSubmittedAttempt,
  listAttemptsForEmployee,
  listQuizzesForEmployee,
  listResultsForEmployee,
} from "../../../shared/services/firestoreApi";
import type { Quiz, Result } from "../../../shared/types/firestore";
import { cn, formatTimestamp } from "../../../shared/utils/ui";
import { isResultVisible } from "../../../shared/utils/publish";
import { EmployeeShell } from "../components/EmployeeShell";
import { QuizStartControl } from "../../quiz/components/QuizStartControl";

function formatTimeRange(open: unknown, close: unknown): string {
  const o = formatTimestamp(open);
  const c = formatTimestamp(close);
  if (!o || !c) return "";
  return `${o} — ${c}`;
}

function openMillis(q: Quiz): number {
  return q.openTime instanceof Timestamp
    ? q.openTime.toDate().getTime()
    : Number.POSITIVE_INFINITY;
}

/** Already-open quizzes first, then the soonest-starting upcoming ones. */
function sortByAvailability(quizzes: Quiz[]): Quiz[] {
  const now = Date.now();
  return [...quizzes].sort((a, b) => {
    const aOpen = openMillis(a) <= now;
    const bOpen = openMillis(b) <= now;
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    return openMillis(a) - openMillis(b);
  });
}

/** Per-quiz card state: has the employee submitted, and is the result visible? */
interface AttemptSummary {
  attempted: boolean;
  resultId: string | null;
  resultPublished: boolean;
}

export function EmployeeHomePage() {
  const { allowed, dbUser } = useRequireRole("employee");
  const { logout } = useAuthCtx();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const [resultByQuiz, setResultByQuiz] = useState<Map<string, Result>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed || !dbUser) return;
    let cancelled = false;

    const load = async () => {
      try {
        // Attempts/results decide whether a card offers a countdown, "Start Quiz",
        // or the results + rank buttons, and keep submitted quizzes on screen.
        const [myAttempts, myResults] = await Promise.all([
          listAttemptsForEmployee(dbUser.uid),
          listResultsForEmployee(dbUser.uid),
        ]);
        if (cancelled) return;

        const submitted = new Set<string>();
        for (const a of myAttempts) {
          if (isSubmittedAttempt(a)) submitted.add(a.quizId);
        }
        const results = new Map<string, Result>();
        for (const r of myResults) results.set(r.quizId, r);

        // Always keep quizzes the employee has already submitted on screen, even
        // when their window has closed.
        const list = await listQuizzesForEmployee(
          dbUser.officeName,
          dbUser.division,
          {
            includeUpcoming: true,
            alwaysIncludeQuizIds: [...submitted],
          }
        );
        if (cancelled) return;

        setSubmittedIds(submitted);
        setResultByQuiz(results);
        setQuizzes(sortByAvailability(list));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [allowed, dbUser]);

  // Card state per quiz. Recomputed on a tick so a scheduled publish time flips
  // the card to "Results published" by itself, without a manual refresh.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const attempts = useMemo<Record<string, AttemptSummary>>(() => {
    const summary: Record<string, AttemptSummary> = {};
    for (const q of quizzes) {
      const qid = q.id ?? "";
      const result = resultByQuiz.get(qid) ?? null;
      if (!submittedIds.has(qid) && !result) continue;
      summary[qid] = {
        attempted: true,
        resultId: result?.id ?? null,
        // Manual publish flag OR a scheduled publish time that has passed.
        resultPublished: isResultVisible(result, q, nowMs),
      };
    }
    return summary;
  }, [quizzes, resultByQuiz, submittedIds, nowMs]);

  useEffect(() => {
    // Tick only while some submitted quiz is still waiting on a future publish.
    const pending = quizzes.some((q) => {
      const qid = q.id ?? "";
      if (!submittedIds.has(qid) && !resultByQuiz.has(qid)) return false;
      return !isResultVisible(resultByQuiz.get(qid) ?? null, q, Date.now());
    });
    if (!pending) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [quizzes, resultByQuiz, submittedIds, nowMs]);

  if (!allowed) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/employee/login", { replace: true });
  };

  return (
    <EmployeeShell
      title={`Welcome, ${dbUser?.name ?? dbUser?.employeeId ?? ""}`}
      subtitle={[dbUser?.officeName, dbUser?.division, dbUser?.designation]
        .filter(Boolean)
        .join(" · ")}
      actions={
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-xs font-medium text-brand-700 bg-brand-50 rounded-md hover:bg-slate-200 ring-1 ring-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-300 transition-colors"
        >
          Logout
        </button>
      }
    >
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h2 className="text-base font-semibold text-slate-900">
            Your Quizzes
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Open now and upcoming, for your office and division
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div
              className={cn(
                "w-8 h-8 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin"
              )}
            />
          </div>
        ) : quizzes.length === 0 ? (
          <div className="bg-white border border-brand-100 rounded-lg px-6 py-16 text-center">
            <p className="text-sm text-slate-500">
              No quizzes currently available for you
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((q) => (
              <div
                key={q.id}
                className="bg-white border border-brand-100 rounded-lg p-5 flex flex-col"
              >
                <h3 className="text-sm font-semibold text-slate-900">
                  {q.name}
                </h3>
                {q.description && (
                  <p className="mt-1 text-xs text-slate-500 break-words whitespace-pre-line">
                    {q.description}
                  </p>
                )}
                <dl className="mt-4 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 shrink-0">Duration</dt>
                    <dd className="font-medium text-slate-700 text-right">
                      {q.durationMinutes} min
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 shrink-0">Questions</dt>
                    <dd className="font-medium text-slate-700 text-right">
                      {q.numQuestionsToShow}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 shrink-0">Marks</dt>
                    <dd className="font-medium text-slate-700 text-right">
                      {q.totalMarks}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 shrink-0">Negative Marking</dt>
                    <dd className="font-medium text-slate-700 text-right">
                      {q.negativeMarking
                        ? `Yes · −${q.negativeMarkValue} per wrong`
                        : "No"}
                    </dd>
                  </div>
                  <div className="pt-1 border-t border-slate-100">
                    <dt className="text-slate-500 mb-0.5">Open Period</dt>
                    <dd className="font-medium text-slate-700 text-[11px] leading-tight">
                      {formatTimeRange(q.openTime, q.closeTime)}
                    </dd>
                  </div>
                  <div className="pt-1 border-t border-slate-100">
                    <dt className="text-slate-500 mb-0.5">Result Publish Time</dt>
                    <dd className="font-medium text-slate-700 text-[11px] leading-tight">
                      {formatTimestamp(q.resultsPublishAt) || "Not scheduled"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <QuizStartControl
                    quizId={q.id ?? ""}
                    openTime={q.openTime}
                    attempted={attempts[q.id ?? ""]?.attempted}
                    resultId={attempts[q.id ?? ""]?.resultId}
                    resultPublished={attempts[q.id ?? ""]?.resultPublished}
                    resultPublishAt={q.resultsPublishAt}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </EmployeeShell>
  );
}
