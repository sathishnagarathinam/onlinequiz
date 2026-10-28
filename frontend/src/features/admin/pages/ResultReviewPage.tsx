import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";
import {
  getQuiz,
  listResults,
  updateResult,
  publishResultsForQuiz,
  publishRankForQuiz,
  getOfficeMaster,
  listQuizzes,
} from "../../../shared/services/firestoreApi";
import { writeAuditLog } from "../../../shared/services/functionsApi";
import { useAuthState } from "../../../shared/hooks/useAuthState";
import { useAuthCtx } from "../../auth/context/AuthContext";
import {
  exportRankExcel,
  exportRankPdf,
} from "../../../shared/utils/export";
import { cn, formatSeconds } from "../../../shared/utils/ui";
import type { Result, Quiz, OfficeMaster } from "../../../shared/types/firestore";

interface AdjustedState {
  [resultId: string]: number;
}

interface ToastState {
  message: string;
  type: "success" | "error";
  id: number;
}

export default function ResultReviewPage() {
  const { quizId: quizIdParam } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { dbUser } = useAuthState();
  const { adminIdentity } = useAuthCtx();

  const [selectedQuizId, setSelectedQuizId] = useState<string>(quizIdParam ?? "");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [officeMaster, setOfficeMaster] = useState<OfficeMaster | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adjustedValues, setAdjustedValues] = useState<AdjustedState>({});
  const [savingAdjust, setSavingAdjust] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [officeFilter, setOfficeFilter] = useState<string>("all");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [designationFilter, setDesignationFilter] = useState<string>("all");
  const [scoreMin, setScoreMin] = useState<string>("");
  const [scoreMax, setScoreMax] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");

  const showToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToast({ message, type, id });
    setTimeout(() => {
      setToast((t) => (t && t.id === id ? null : t));
    }, 4000);
  };

  useEffect(() => {
    if (quizIdParam) {
      setSelectedQuizId(quizIdParam);
    }
  }, [quizIdParam]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [quizzesData, omData] = await Promise.all([
          listQuizzes(),
          getOfficeMaster(),
        ]);
        setAllQuizzes(quizzesData);
        setOfficeMaster(omData);

        if (selectedQuizId) {
          const [resultsData, quizData] = await Promise.all([
            listResults(selectedQuizId),
            getQuiz(selectedQuizId),
          ]);
          setResults(resultsData);
          setQuiz(quizData);
          const initial: AdjustedState = {};
          resultsData.forEach((r) => {
            if (r.id) {
              initial[r.id] = r.adjustedScore ?? r.score;
            }
          });
          setAdjustedValues(initial);
        } else {
          setResults([]);
          setQuiz(null);
          setAdjustedValues({});
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [selectedQuizId]);

  const adminUid = adminIdentity?.uid ?? dbUser?.uid ?? "";
  const adminEmail = adminIdentity?.email ?? dbUser?.email ?? undefined;

  const officeOptions = useMemo(() => {
    const fromMaster = officeMaster?.offices ?? [];
    const fromResults = Array.from(new Set(results.map((r) => r.officeName).filter(Boolean) as string[]));
    const merged = Array.from(new Set([...fromMaster, ...fromResults])).sort();
    return merged;
  }, [officeMaster, results]);

  const divisionOptions = useMemo(() => {
    const fromMaster = officeMaster?.divisions ?? [];
    const fromResults = Array.from(new Set(results.map((r) => r.division).filter(Boolean) as string[]));
    const merged = Array.from(new Set([...fromMaster, ...fromResults])).sort();
    return merged;
  }, [officeMaster, results]);

  const designationOptions = useMemo(() => {
    const fromMaster = officeMaster?.designations ?? [];
    const fromResults = Array.from(new Set(results.map((r) => r.designation).filter(Boolean) as string[]));
    const merged = Array.from(new Set([...fromMaster, ...fromResults])).sort();
    return merged;
  }, [officeMaster, results]);

  const filteredRankRows = useMemo(() => {
    return results.filter((r) => {
      if (officeFilter !== "all" && r.officeName !== officeFilter) return false;
      if (divisionFilter !== "all" && r.division !== divisionFilter) return false;
      if (designationFilter !== "all" && r.designation !== designationFilter) return false;
      const displayScore = r.adjustedScore ?? r.score;
      if (scoreMin !== "" && displayScore < Number(scoreMin)) return false;
      if (scoreMax !== "" && displayScore > Number(scoreMax)) return false;
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        const nameMatch = (r.employeeName ?? "").toLowerCase().includes(q);
        const empIdMatch = (r.employeeId ?? "").toLowerCase().includes(q);
        if (!nameMatch && !empIdMatch) return false;
      }
      return true;
    });
  }, [results, officeFilter, divisionFilter, designationFilter, scoreMin, scoreMax, searchText]);

  const handleQuizSelect = (id: string) => {
    if (id) {
      navigate(`/admin/results/${id}`, { replace: true });
    }
  };

  const handlePublishAll = async (publish: boolean) => {
    if (!selectedQuizId) return;
    setActionLoading(publish ? "publish-all" : "unpublish-all");
    try {
      await publishResultsForQuiz(selectedQuizId, publish);
      await writeAuditLog({
        action: publish ? "results.publish" : "results.unpublish",
        adminUid,
        adminEmail,
        payload: { quizId: selectedQuizId, count: results.length },
      });
      setResults((prev) => prev.map((r) => ({ ...r, published: publish })));
      if (publish) {
        showToast(`Published ${results.length} results`);
      } else {
        showToast(`Unpublished ${results.length} results`);
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to update publish status", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleRankPublish = async () => {
    if (!selectedQuizId || !quiz) return;
    const nextPublish = !quiz.rankListPublished;
    setActionLoading(nextPublish ? "rank-publish" : "rank-unpublish");
    try {
      await publishRankForQuiz(selectedQuizId, nextPublish);
      await writeAuditLog({
        action: nextPublish ? "rank.publish" : "rank.unpublish",
        adminUid,
        adminEmail,
        payload: { quizId: selectedQuizId },
      });
      setQuiz((prev) => (prev ? { ...prev, rankListPublished: nextPublish } : prev));
      showToast(nextPublish ? "Rank list published" : "Rank list unpublished");
    } catch (e) {
      console.error(e);
      showToast("Failed to update rank publish status", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveAdjusted = async (result: Result) => {
    if (!result.id) return;
    setSavingAdjust(result.id);
    try {
      const newVal = adjustedValues[result.id] ?? result.score;
      const oldVal = result.adjustedScore ?? result.score;
      await updateResult(result.id, { adjustedScore: newVal });
      await writeAuditLog({
        action: "results.adjust",
        adminUid,
        adminEmail,
        payload: { resultId: result.id, quizId: selectedQuizId, from: oldVal, to: newVal },
      });
      setResults((prev) =>
        prev.map((r) => (r.id === result.id ? { ...r, adjustedScore: newVal } : r))
      );
      showToast("Score adjustment saved");
    } catch (e) {
      console.error(e);
      showToast("Failed to save adjustment", "error");
    } finally {
      setSavingAdjust(null);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedQuizId) return;
    try {
      await exportRankExcel(filteredRankRows, `results-${selectedQuizId}-${Date.now()}.xlsx`);
      showToast("Excel export started");
    } catch (e) {
      console.error(e);
      showToast("Failed to export Excel", "error");
    }
  };

  const handleExportPdf = async () => {
    if (!selectedQuizId) return;
    try {
      await exportRankPdf(
        filteredRankRows,
        `${quiz?.name ?? "Quiz"} — Rank List`,
        `results-${selectedQuizId}-${Date.now()}.pdf`
      );
      showToast("PDF export started");
    } catch (e) {
      console.error(e);
      showToast("Failed to export PDF", "error");
    }
  };

  const clearFilters = () => {
    setOfficeFilter("all");
    setDivisionFilter("all");
    setDesignationFilter("all");
    setScoreMin("");
    setScoreMax("");
    setSearchText("");
  };

  return (
    <AdminLayout title="Result Review">
      <div className="relative space-y-4">
        {toast && (
          <div
            className={cn(
              "fixed top-4 right-4 z-50 rounded-md px-4 py-2.5 text-xs font-medium shadow-lg border",
              toast.type === "success"
                ? "bg-green-50 text-green-800 border-green-200"
                : "bg-red-50 text-red-800 border-red-200"
            )}
          >
            {toast.message}
          </div>
        )}

        {!selectedQuizId ? (
          <div className="bg-white rounded-lg border border-brand-100 shadow-sm p-4 sm:p-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select a quiz to review results
            </label>
            <select
              value={selectedQuizId}
              onChange={(e) => handleQuizSelect(e.target.value)}
              className="w-full max-w-md px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
            >
              <option value="">— Select Quiz —</option>
              {allQuizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold text-slate-900 truncate">
                    {quiz?.name ?? "Loading quiz..."}
                  </h1>
                  <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-brand-100">
                    {results.length} result{results.length === 1 ? "" : "s"}
                  </span>
                  {quiz?.forceClosed && (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 border border-red-200">
                      Force Closed
                    </span>
                  )}
                  {quiz?.resultsPublished ? (
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                      Results Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                      Not Published
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3 flex-wrap text-xs text-slate-500">
                  <label className="inline-flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Quiz:</span>
                    <select
                      value={selectedQuizId}
                      onChange={(e) => handleQuizSelect(e.target.value)}
                      className="px-2 py-1 rounded border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 bg-white"
                    >
                      {allQuizzes.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="font-mono text-slate-400">ID: {selectedQuizId}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-brand-100 shadow-sm p-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void handlePublishAll(true)}
                  disabled={
                    loading ||
                    actionLoading !== null ||
                    results.length === 0
                  }
                  className={cn(
                    "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition",
                    "bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {actionLoading === "publish-all" ? "Publishing…" : "Publish All Results"}
                </button>
                <button
                  onClick={() => void handlePublishAll(false)}
                  disabled={
                    loading ||
                    actionLoading !== null ||
                    results.length === 0
                  }
                  className={cn(
                    "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition",
                    "bg-slate-500 text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {actionLoading === "unpublish-all" ? "Unpublishing…" : "Unpublish All"}
                </button>

                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-brand-100 bg-white cursor-pointer hover:bg-brand-50 transition">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={!!quiz?.rankListPublished}
                    disabled={actionLoading !== null || !quiz}
                    onChange={() => void handleToggleRankPublish()}
                  />
                  <div
                    className={cn(
                      "relative w-8 h-4.5 rounded-full peer transition-colors",
                      "peer-checked:bg-green-600 bg-slate-300",
                      "after:content-[''] after:absolute after:top-0.5 after:left-0.5",
                      "after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all",
                      "peer-checked:after:translate-x-4 peer-disabled:opacity-50"
                    )}
                  />
                  <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
                    {quiz?.rankListPublished ? "Rank Published" : "Publish Rank List"}
                  </span>
                </label>

                <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

                <button
                  onClick={() => void handleExportExcel()}
                  disabled={loading || results.length === 0}
                  className={cn(
                    "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition",
                    "border border-brand-100 bg-white text-slate-700 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Excel
                </button>
                <button
                  onClick={() => void handleExportPdf()}
                  disabled={loading || results.length === 0}
                  className={cn(
                    "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition",
                    "border border-brand-100 bg-white text-slate-700 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Export PDF
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-brand-100 shadow-sm p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Office</label>
                  <select
                    value={officeFilter}
                    onChange={(e) => setOfficeFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
                  >
                    <option value="all">All Offices</option>
                    {officeOptions.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Division</label>
                  <select
                    value={divisionFilter}
                    onChange={(e) => setDivisionFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
                  >
                    <option value="all">All Divisions</option>
                    {divisionOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Designation</label>
                  <select
                    value={designationFilter}
                    onChange={(e) => setDesignationFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
                  >
                    <option value="all">All Designations</option>
                    {designationOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Score Min</label>
                  <input
                    type="number"
                    step="0.25"
                    value={scoreMin}
                    onChange={(e) => setScoreMin(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Score Max</label>
                  <input
                    type="number"
                    step="0.25"
                    value={scoreMax}
                    onChange={(e) => setScoreMax(e.target.value)}
                    placeholder="100"
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Search</label>
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Name / Employee ID"
                    className="w-full px-2.5 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
                  />
                </div>
                <div>
                  <button
                    onClick={clearFilters}
                    className="w-full px-2.5 py-1.5 rounded-md border border-brand-100 bg-brand-50 text-xs font-medium text-slate-700 hover:bg-brand-50 transition"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {loading
                  ? "Loading..."
                  : `Showing ${filteredRankRows.length} of ${results.length} results`}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-brand-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-[calc(100vh-400px)] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-brand-50 text-slate-500 text-left sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 font-medium w-10">#</th>
                      <th className="px-3 py-2 font-medium w-12">Rank</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Employee ID</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Name</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Office</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Division</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Designation</th>
                      <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Correct</th>
                      <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Wrong</th>
                      <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Skipped</th>
                      <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Score</th>
                      <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Total</th>
                      <th className="px-3 py-2 font-medium text-right whitespace-nowrap">%</th>
                      <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Time Taken</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Adjusted Score</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Save</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={17} className="px-4 py-16 text-center text-slate-400">
                          <div className="inline-flex items-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-100 border-t-slate-700" />
                            Loading results...
                          </div>
                        </td>
                      </tr>
                    ) : results.length === 0 ? (
                      <tr>
                        <td colSpan={17} className="px-4 py-16 text-center text-slate-400">
                          No results yet — wait for candidates to submit and evaluations to run.
                        </td>
                      </tr>
                    ) : filteredRankRows.length === 0 ? (
                      <tr>
                        <td colSpan={17} className="px-4 py-16 text-center text-slate-400">
                          No results match the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredRankRows.map((result, i) => {
                        const overallIndex = results.findIndex((r) => r.id === result.id);
                        const rank = overallIndex >= 0 ? overallIndex + 1 : i + 1;
                        const currentAdjusted = adjustedValues[result.id!] ?? result.score;
                        const originalAdjusted = result.adjustedScore ?? result.score;
                        const isDirty = Math.abs(currentAdjusted - originalAdjusted) > 0.0001;
                        const displayScore = result.adjustedScore ?? result.score;
                        const percent = result.totalMarks > 0
                          ? ((displayScore / result.totalMarks) * 100).toFixed(2)
                          : result.percentage.toFixed(2);

                        return (
                          <tr
                            key={result.id}
                            className={cn(
                              i % 2 === 0 ? "bg-white" : "bg-gray-50",
                              "border-t border-slate-100 hover:bg-brand-50"
                            )}
                          >
                            <td className="px-3 py-2 text-slate-500 align-top">{i + 1}</td>
                            <td className="px-3 py-2 font-semibold text-slate-900 align-top">{rank}</td>
                            <td className="px-3 py-2 text-slate-600 font-mono align-top whitespace-nowrap">
                              {result.employeeId}
                            </td>
                            <td className="px-3 py-2 text-slate-900 font-medium align-top whitespace-nowrap">
                              {result.employeeName ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-600 align-top whitespace-nowrap">
                              {result.officeName ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-600 align-top whitespace-nowrap">
                              {result.division ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-600 align-top whitespace-nowrap">
                              {result.designation ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-green-600 align-top">
                              {result.correctCount}
                            </td>
                            <td className="px-3 py-2 text-right text-red-600 align-top">
                              {result.wrongCount}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-500 align-top">
                              {result.skippedCount}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-900 font-medium align-top">
                              {result.score}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600 align-top">
                              {result.totalMarks}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600 align-top">
                              {percent}%
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600 align-top whitespace-nowrap">
                              {formatSeconds(result.timeTaken)}
                            </td>
                            <td className="px-3 py-2 align-top whitespace-nowrap">
                              <input
                                type="number"
                                step="0.25"
                                value={adjustedValues[result.id!] ?? ""}
                                onChange={(e) =>
                                  setAdjustedValues((prev) => ({
                                    ...prev,
                                    [result.id!]: Number(e.target.value),
                                  }))
                                }
                                className={cn(
                                  "w-20 px-2 py-1 rounded border text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500",
                                  isDirty
                                    ? "border-brand-400 bg-brand-50"
                                    : "border-slate-300 bg-white"
                                )}
                              />
                            </td>
                            <td className="px-3 py-2 align-top whitespace-nowrap">
                              <button
                                onClick={() => void handleSaveAdjusted(result)}
                                disabled={!isDirty || savingAdjust === result.id}
                                className={cn(
                                  "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition",
                                  "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
                                )}
                              >
                                {savingAdjust === result.id ? "…" : "Save"}
                              </button>
                            </td>
                            <td className="px-3 py-2 align-top whitespace-nowrap">
                              {result.published ? (
                                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 border border-green-200">
                                  Published
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                                  Draft
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
