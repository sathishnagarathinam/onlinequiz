import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRequireRole } from "../../../shared/hooks/useAuthState";
import { useAuthCtx } from "../../auth/context/AuthContext";
import {
  getQuiz,
  listResults,
  listQuizzesForEmployee,
} from "../../../shared/services/firestoreApi";
import type { Quiz, Result } from "../../../shared/types/firestore";
import { cn, formatSeconds } from "../../../shared/utils/ui";
import { isRankVisible } from "../../../shared/utils/publish";
import { EmployeeShell } from "../../auth/components/EmployeeShell";

interface RankedResult extends Result {
  rank: number;
}

const TOP_N = 10;

export function EmployeeRankViewPage() {
  const { quizId: urlQuizId } = useParams<{ quizId?: string }>();
  const navigate = useNavigate();
  const { allowed, dbUser, loading: authLoading } = useRequireRole("employee");
  const { logout } = useAuthCtx();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>(urlQuizId ?? "");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [results, setResults] = useState<RankedResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Re-evaluated on a tick so the leaderboard appears by itself once the
  // scheduled rank-publish time is reached.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const rankVisible = isRankVisible(quiz, nowMs);
  useEffect(() => {
    if (!quiz || rankVisible) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [quiz, rankVisible]);

  const loadAvailableQuizzes = async () => {
    if (!dbUser) return;
    try {
      const qs = await listQuizzesForEmployee(dbUser.officeName, dbUser.division, {
        includeClosed: true,
      });
      setQuizzes(qs);
    } catch (e) {
      console.warn("load quizzes failed", e);
    }
  };

  const loadRank = async (qid: string) => {
    if (!qid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [quizData, resultsData] = await Promise.all([
        getQuiz(qid),
        listResults(qid),
      ]);
      setQuiz(quizData);
      const ranked: RankedResult[] = resultsData.map((r, idx) => ({
        ...r,
        rank: idx + 1,
      }));
      setResults(ranked);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!allowed || authLoading || !dbUser) return;
    void loadAvailableQuizzes();
  }, [allowed, authLoading, dbUser]);

  useEffect(() => {
    if (urlQuizId) {
      setSelectedQuizId(urlQuizId);
      void loadRank(urlQuizId);
    } else {
      setLoading(false);
    }
  }, [urlQuizId]);

  const handleQuizChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const qid = e.target.value;
    setSelectedQuizId(qid);
    if (qid) {
      navigate(`/employee/ranks/${qid}`, { replace: true });
      void loadRank(qid);
    } else {
      navigate("/employee/ranks", { replace: true });
      setQuiz(null);
      setResults([]);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/employee/login", { replace: true });
  };

  const myResult = useMemo(() => {
    if (!dbUser) return null;
    return (
      results.find((r) => r.uid === dbUser.uid || r.employeeId === dbUser.employeeId) ??
      null
    );
  }, [results, dbUser]);

  const topResults = useMemo(() => results.slice(0, TOP_N), [results]);

  const showMyRowSeparately = useMemo(
    () => myResult != null && myResult.rank > TOP_N,
    [myResult]
  );

  if (!allowed && !authLoading) return null;

  return (
    <EmployeeShell
      title="Leaderboard"
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
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-5">
        <div className="bg-white rounded-lg border border-brand-100 shadow-sm p-5">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Select Quiz
          </label>
          <select
            value={selectedQuizId}
            onChange={handleQuizChange}
            className={cn(
              "w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2",
              "text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none",
              "focus:ring-1 focus:ring-brand-400"
            )}
          >
            <option value="">— Select a quiz —</option>
            {quizzes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </div>

        {selectedQuizId && (
          <>
            {loading ? (
              <div className="bg-white rounded-lg border border-brand-100 shadow-sm p-10 text-center text-slate-400">
                Loading leaderboard...
              </div>
            ) : !quiz ? (
              <div className="bg-white rounded-lg border border-brand-100 shadow-sm p-10 text-center text-slate-400">
                Quiz not found.
              </div>
            ) : !rankVisible ? (
              <div className="bg-white rounded-lg border border-brand-100 shadow-sm p-10 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-slate-900">Rank List Not Published</h2>
                <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
                  The leaderboard for <strong>{quiz.name}</strong> has not been published yet.
                  Please check back later.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{quiz.name}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Top {Math.min(TOP_N, results.length)} of {results.length}
                    </p>
                  </div>
                  {myResult && (
                    <div className="bg-brand-700 text-white rounded-lg px-4 py-2.5 text-right">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">
                        Your Rank
                      </div>
                      <div className="text-xl font-bold leading-tight">
                        #{myResult.rank}
                        <span className="ml-2 text-sm font-normal text-slate-300">
                          {(myResult.adjustedScore ?? myResult.score)} / {myResult.totalMarks}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg border border-brand-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-brand-50 text-slate-500 text-left">
                        <tr>
                          <th className="px-4 py-3 font-medium">Rank</th>
                          <th className="px-4 py-3 font-medium">Employee ID</th>
                          <th className="px-4 py-3 font-medium">Name</th>
                          <th className="px-4 py-3 font-medium">Office</th>
                          <th className="px-4 py-3 font-medium">Designation</th>
                          <th className="px-4 py-3 font-medium text-right">Score</th>
                          <th className="px-4 py-3 font-medium text-right">%</th>
                          <th className="px-4 py-3 font-medium text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {topResults.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                              No results yet.
                            </td>
                          </tr>
                        ) : (
                          topResults.map((r) => {
                            const isMe = myResult?.id === r.id;
                            const displayScore = r.adjustedScore ?? r.score;
                            const displayPct = r.totalMarks > 0
                              ? (displayScore / r.totalMarks) * 100
                              : 0;
                            return (
                              <tr
                                key={r.id}
                                className={cn(
                                  "transition-colors",
                                  isMe && "bg-emerald-50"
                                )}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "font-semibold",
                                        r.rank === 1 && "text-amber-600",
                                        r.rank === 2 && "text-slate-500",
                                        r.rank === 3 && "text-amber-700",
                                        r.rank > 3 && "text-slate-900"
                                      )}
                                    >
                                      #{r.rank}
                                    </span>
                                    {isMe && (
                                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                        You
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                                  {r.employeeId}
                                </td>
                                <td className="px-4 py-3 text-slate-900">
                                  {r.employeeName ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {r.officeName ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {r.designation ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-slate-900">
                                  {displayScore} / {r.totalMarks}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-700">
                                  {r.adjustedScore != null
                                    ? displayPct.toFixed(1)
                                    : r.percentage.toFixed(1)}%
                                </td>
                                <td className="px-4 py-3 text-right text-slate-600">
                                  {formatSeconds(r.timeTaken)}
                                </td>
                              </tr>
                            );
                          })
                        )}

                        {showMyRowSeparately && myResult && (
                          <>
                            <tr className="bg-brand-50/60">
                              <td colSpan={8} className="px-4 py-1.5 text-center text-xs text-slate-500">
                                — Your Position —
                              </td>
                            </tr>
                            {(() => {
                              const r = myResult;
                              const displayScore = r.adjustedScore ?? r.score;
                              const displayPct = r.totalMarks > 0
                                ? (displayScore / r.totalMarks) * 100
                                : 0;
                              return (
                                <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-900">#{r.rank}</span>
                                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                        You
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                                    {r.employeeId}
                                  </td>
                                  <td className="px-4 py-3 text-slate-900">
                                    {r.employeeName ?? "—"}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">
                                    {r.officeName ?? "—"}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">
                                    {r.designation ?? "—"}
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                                    {displayScore} / {r.totalMarks}
                                  </td>
                                  <td className="px-4 py-3 text-right text-slate-700">
                                    {r.adjustedScore != null
                                      ? displayPct.toFixed(1)
                                      : r.percentage.toFixed(1)}%
                                  </td>
                                  <td className="px-4 py-3 text-right text-slate-600">
                                    {formatSeconds(r.timeTaken)}
                                  </td>
                                </tr>
                              );
                            })()}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {myResult && !showMyRowSeparately && topResults.length === 0 && (
                  <div className="bg-white rounded-lg border border-brand-100 shadow-sm p-5">
                    <p className="text-sm text-slate-500 text-center">
                      You are not in the top {TOP_N}. Your rank is #{myResult.rank}.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </EmployeeShell>
  );
}
