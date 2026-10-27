import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";
import {
  listResults,
  listQuizzes,
  getQuiz,
  publishRankForQuiz,
} from "../../../shared/services/firestoreApi";
import { writeAuditLog } from "../../../shared/services/functionsApi";
import { exportRankExcel, exportRankPdf } from "../../../shared/utils/export";
import type { Result, Quiz } from "../../../shared/types/firestore";
import { cn, formatSeconds } from "../../../shared/utils/ui";
import { useAuthCtx } from "../../auth/context/AuthContext";

function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-4",
    lg: "h-12 w-12 border-4",
  };
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-brand-100 border-t-slate-900",
        sizeClasses[size]
      )}
    />
  );
}

export default function LeaderboardPage() {
  const { quizId: paramQuizId } = useParams<{ quizId: string }>();
  const { adminIdentity } = useAuthCtx();
  const navigate = useNavigate();

  const [selectedQuizId, setSelectedQuizId] = useState<string>(paramQuizId ?? "");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [rankLoading, setRankLoading] = useState<string | null>(null);

  const [filterOffice, setFilterOffice] = useState<string>("");
  const [filterDivision, setFilterDivision] = useState<string>("");
  const [filterDesignation, setFilterDesignation] = useState<string>("");
  const [filterScoreMin, setFilterScoreMin] = useState<string>("");
  const [filterScoreMax, setFilterScoreMax] = useState<string>("");
  const [filterSearch, setFilterSearch] = useState<string>("");

  useEffect(() => {
    const loadQuizzes = async () => {
      setLoading(true);
      try {
        const data = await listQuizzes();
        setQuizzes(data);
      } finally {
        setLoading(false);
      }
    };
    void loadQuizzes();
  }, []);

  useEffect(() => {
    if (paramQuizId) {
      setSelectedQuizId(paramQuizId);
    }
  }, [paramQuizId]);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedQuizId) {
        setQuiz(null);
        setResults([]);
        return;
      }
      setResultsLoading(true);
      try {
        const [quizData, resultsData] = await Promise.all([
          getQuiz(selectedQuizId),
          listResults(selectedQuizId),
        ]);
        setQuiz(quizData);
        setResults(resultsData);
      } finally {
        setResultsLoading(false);
      }
    };
    void loadData();
  }, [selectedQuizId]);

  useEffect(() => {
    setFilterOffice("");
    setFilterDivision("");
    setFilterDesignation("");
    setFilterScoreMin("");
    setFilterScoreMax("");
    setFilterSearch("");
  }, [selectedQuizId]);

  const uniqueOffices = useMemo(
    () => Array.from(new Set(results.map((r) => r.officeName).filter(Boolean) as string[])).sort(),
    [results]
  );

  const uniqueDivisions = useMemo(
    () => Array.from(new Set(results.map((r) => r.division).filter(Boolean) as string[])).sort(),
    [results]
  );

  const uniqueDesignations = useMemo(
    () => Array.from(new Set(results.map((r) => r.designation).filter(Boolean) as string[])).sort(),
    [results]
  );

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      const displayScore = r.adjustedScore ?? r.score;
      if (filterOffice && r.officeName !== filterOffice) return false;
      if (filterDivision && r.division !== filterDivision) return false;
      if (filterDesignation && r.designation !== filterDesignation) return false;
      if (filterScoreMin !== "" && !isNaN(Number(filterScoreMin))) {
        if (displayScore < Number(filterScoreMin)) return false;
      }
      if (filterScoreMax !== "" && !isNaN(Number(filterScoreMax))) {
        if (displayScore > Number(filterScoreMax)) return false;
      }
      if (filterSearch) {
        const search = filterSearch.toLowerCase();
        const name = (r.employeeName ?? "").toLowerCase();
        const empId = (r.employeeId ?? "").toLowerCase();
        if (!name.includes(search) && !empId.includes(search)) return false;
      }
      return true;
    });
  }, [
    results,
    filterOffice,
    filterDivision,
    filterDesignation,
    filterScoreMin,
    filterScoreMax,
    filterSearch,
  ]);

  const stats = useMemo(() => {
    if (filteredResults.length === 0) {
      return {
        totalCandidates: 0,
        topScore: 0,
        avgPercent: 0,
        avgTime: 0,
      };
    }
    const scores = filteredResults.map((r) => r.adjustedScore ?? r.score);
    const percents = filteredResults.map((r) => r.percentage);
    const times = filteredResults.map((r) => r.timeTaken);
    return {
      totalCandidates: filteredResults.length,
      topScore: Math.max(...scores),
      avgPercent: percents.reduce((a, b) => a + b, 0) / percents.length,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    };
  }, [filteredResults]);

  const handleQuizChange = (id: string) => {
    setSelectedQuizId(id);
    if (id) {
      navigate(`/admin/leaderboard/${id}`, { replace: false });
    } else {
      navigate("/admin/leaderboard", { replace: false });
    }
  };

  const rankPublished = quiz?.rankListPublished ?? false;
  const quizName = quiz?.name ?? "";

  const handleToggleRankPublish = async (publish: boolean) => {
    if (!selectedQuizId || !quiz) return;
    setRankLoading(publish ? "publish" : "unpublish");
    try {
      await publishRankForQuiz(selectedQuizId, publish);
      const adminUid = adminIdentity?.uid ?? "";
      const adminEmail = adminIdentity?.email ?? undefined;
      await writeAuditLog({
        action: publish ? "rank.publish" : "rank.unpublish",
        adminUid,
        adminEmail,
        payload: {
          quizId: selectedQuizId,
          count: results.length,
        },
      });
      setQuiz((prev) => (prev ? { ...prev, rankListPublished: publish } : prev));
      setQuizzes((prev) =>
        prev.map((q) => (q.id === selectedQuizId ? { ...q, rankListPublished: publish } : q))
      );
    } finally {
      setRankLoading(null);
    }
  };

  const handleExportExcel = async () => {
    const filename = `leaderboard-${selectedQuizId}-${Date.now()}.xlsx`;
    await exportRankExcel(filteredResults, filename);
  };

  const handleExportPdf = async () => {
    const title = `${quizName} — Rank List`;
    const filename = `leaderboard-${selectedQuizId}-${Date.now()}.pdf`;
    await exportRankPdf(filteredResults, title, filename);
  };

  const handleClearFilters = () => {
    setFilterOffice("");
    setFilterDivision("");
    setFilterDesignation("");
    setFilterScoreMin("");
    setFilterScoreMax("");
    setFilterSearch("");
  };

  const getMedal = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return "";
  };

  const getRowBgClass = (rank: number) => {
    if (rank === 1) return "bg-amber-50";
    if (rank === 2) return "bg-gray-100";
    if (rank === 3) return "bg-orange-50";
    return "";
  };

  const participantCount = results.length;

  return (
    <AdminLayout title="Leaderboard / Rank List">
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-brand-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Quiz:</label>
            <div className="flex-1 max-w-md">
              <select
                value={selectedQuizId}
                onChange={(e) => handleQuizChange(e.target.value)}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-sm outline-none transition bg-white",
                  "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600 border-slate-300"
                )}
                disabled={loading}
              >
                <option value="">Select a quiz…</option>
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                    {q.rankListPublished ? " (Published)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedQuizId && (resultsLoading || quiz) && (
          <div className="bg-white rounded-lg border border-brand-100 p-5 shadow-sm space-y-4">
            {resultsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold text-slate-900">{quizName}</h2>
                      {rankPublished ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                          Rank List Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                          Rank Not Published (admin preview only)
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {participantCount} participant{participantCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {rankPublished ? (
                    <button
                      onClick={() => void handleToggleRankPublish(false)}
                      disabled={rankLoading !== null}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition",
                        "border border-brand-100 bg-white text-slate-700 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {rankLoading === "unpublish" ? (
                        <Spinner size="sm" />
                      ) : (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                          />
                        </svg>
                      )}
                      {rankLoading === "unpublish" ? "Unpublishing…" : "Unpublish Rank List"}
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleToggleRankPublish(true)}
                      disabled={rankLoading !== null}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition",
                        "bg-brand-700 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {rankLoading === "publish" ? (
                        <Spinner size="sm" />
                      ) : (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                      {rankLoading === "publish" ? "Publishing…" : "Publish Rank List"}
                    </button>
                  )}

                  <button
                    onClick={() => void handleExportExcel()}
                    disabled={filteredResults.length === 0}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition",
                      "border border-brand-100 bg-white text-slate-700 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Export Excel
                  </button>

                  <button
                    onClick={() => void handleExportPdf()}
                    disabled={filteredResults.length === 0}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition",
                      "border border-brand-100 bg-white text-slate-700 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Export PDF
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Office</label>
                    <select
                      value={filterOffice}
                      onChange={(e) => setFilterOffice(e.target.value)}
                      className={cn(
                        "w-full rounded-md border px-3 py-1.5 text-xs outline-none transition bg-white",
                        "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600 border-slate-300"
                      )}
                    >
                      <option value="">All</option>
                      {uniqueOffices.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Division</label>
                    <select
                      value={filterDivision}
                      onChange={(e) => setFilterDivision(e.target.value)}
                      className={cn(
                        "w-full rounded-md border px-3 py-1.5 text-xs outline-none transition bg-white",
                        "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600 border-slate-300"
                      )}
                    >
                      <option value="">All</option>
                      {uniqueDivisions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Designation</label>
                    <select
                      value={filterDesignation}
                      onChange={(e) => setFilterDesignation(e.target.value)}
                      className={cn(
                        "w-full rounded-md border px-3 py-1.5 text-xs outline-none transition bg-white",
                        "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600 border-slate-300"
                      )}
                    >
                      <option value="">All</option>
                      {uniqueDesignations.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Score Range</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={filterScoreMin}
                        onChange={(e) => setFilterScoreMin(e.target.value)}
                        placeholder="0"
                        className={cn(
                          "w-full rounded-md border px-3 py-1.5 text-xs outline-none transition",
                          "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600 border-slate-300"
                        )}
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={filterScoreMax}
                        onChange={(e) => setFilterScoreMax(e.target.value)}
                        placeholder="100"
                        className={cn(
                          "w-full rounded-md border px-3 py-1.5 text-xs outline-none transition",
                          "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600 border-slate-300"
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Search (Name / ID)
                      </label>
                      <input
                        type="text"
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        placeholder="Search…"
                        className={cn(
                          "w-full rounded-md border px-3 py-1.5 text-xs outline-none transition",
                          "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600 border-slate-300"
                        )}
                      />
                    </div>
                    <div>
                      <button
                        onClick={handleClearFilters}
                        className={cn(
                          "w-full whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition",
                          "border border-brand-100 bg-white text-slate-700 hover:bg-brand-50"
                        )}
                        style={{ marginTop: "1.25rem" }}
                      >
                        Clear Filters
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-brand-100 pt-4">
                  <div className="bg-brand-50 rounded-md p-3">
                    <p className="text-xs text-slate-500 font-medium">Total Candidates</p>
                    <p className="text-xl font-semibold text-slate-900 mt-1">
                      {stats.totalCandidates}
                    </p>
                  </div>
                  <div className="bg-brand-50 rounded-md p-3">
                    <p className="text-xs text-slate-500 font-medium">Top Score</p>
                    <p className="text-xl font-semibold text-slate-900 mt-1">{stats.topScore}</p>
                  </div>
                  <div className="bg-brand-50 rounded-md p-3">
                    <p className="text-xs text-slate-500 font-medium">Average %</p>
                    <p className="text-xl font-semibold text-slate-900 mt-1">
                      {stats.avgPercent.toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-brand-50 rounded-md p-3">
                    <p className="text-xs text-slate-500 font-medium">Avg Time Taken</p>
                    <p className="text-xl font-semibold text-slate-900 mt-1">
                      {formatSeconds(stats.avgTime)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {selectedQuizId && !resultsLoading && (
          <div className="bg-white rounded-lg border border-brand-100 shadow-sm overflow-hidden">
            {resultsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto h-12 w-12 text-slate-300 mb-3">
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.422 48.422 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-slate-500">
                  {results.length === 0
                    ? "No results found for this quiz."
                    : "No results match the current filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-brand-50 text-slate-500 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Rank</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Medal</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Employee ID</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Name</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Office</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Division</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Designation</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap text-right">Correct</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap text-right">Wrong</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap text-right">Skipped</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap text-right">Score</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap text-right">Total</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap text-right">%</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap text-right">
                        Time Taken
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredResults.map((result) => {
                      const overallIndex = results.findIndex((r) => r.id === result.id);
                      const rank = overallIndex >= 0 ? overallIndex + 1 : 0;
                      const displayScore = result.adjustedScore ?? result.score;
                      return (
                        <tr
                          key={result.id}
                          className={cn(getRowBgClass(rank), "hover:bg-opacity-75")}
                        >
                          <td className="px-3 py-1.5 font-semibold text-slate-900">{rank}</td>
                          <td className="px-3 py-1.5 text-lg">{getMedal(rank)}</td>
                          <td className="px-3 py-1.5 text-slate-600 font-mono">
                            {result.employeeId}
                          </td>
                          <td className="px-3 py-1.5 text-slate-900">
                            {result.employeeName ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">
                            {result.officeName ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">
                            {result.division ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">
                            {result.designation ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right text-green-700 font-medium">
                            {result.correctCount}
                          </td>
                          <td className="px-3 py-1.5 text-right text-red-700 font-medium">
                            {result.wrongCount}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-500">
                            {result.skippedCount}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-900 font-semibold">
                            {displayScore}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-600">
                            {result.totalMarks}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-900 font-medium">
                            {result.percentage.toFixed(2)}%
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-600">
                            {formatSeconds(result.timeTaken)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
