import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { listAllResults, listQuizzes } from "../../../shared/services/firestoreApi";
import type { Quiz, Result } from "../../../shared/types/firestore";
import { formatTimestamp } from "../../../shared/utils/ui";

export default function ResultListPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async () => {
    try { const [resultRows, quizRows] = await Promise.all([listAllResults(), listQuizzes()]); setResults(resultRows); setQuizzes(quizRows); setLastUpdated(new Date()); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 5000); return () => window.clearInterval(timer); }, []);
  const quizNames = useMemo(() => new Map(quizzes.map((q) => [q.id ?? "", q.name])), [quizzes]);
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return results.filter((result) => { if (selectedQuiz && result.quizId !== selectedQuiz) return false; if (!query) return true; return [result.employeeName, result.employeeId, result.officeName, result.division, quizNames.get(result.quizId)].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)); }); }, [results, selectedQuiz, search, quizNames]);

  return <AdminLayout><div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold text-slate-900">All Results</h1><p className="mt-1 text-sm text-slate-500">Live result updates appear automatically every 5 seconds.</p></div><div className="text-xs text-emerald-700">● Live {lastUpdated ? `· Updated ${lastUpdated.toLocaleTimeString()}` : ""}</div></div>
    <div className="flex flex-wrap gap-3 rounded-lg border border-brand-100 bg-white p-4 shadow-sm"><select value={selectedQuiz} onChange={(e) => setSelectedQuiz(e.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">All quizzes</option>{quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.name}</option>)}</select><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search participant, ID, office..." className="min-w-[260px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" /><button type="button" onClick={() => { setLoading(true); void load(); }} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Refresh</button></div>
    <div className="overflow-x-auto rounded-lg border border-brand-100 bg-white shadow-sm"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Participant</th><th className="px-4 py-3">Quiz</th><th className="px-4 py-3">Office / Division</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Correct</th><th className="px-4 py-3">Wrong</th><th className="px-4 py-3">Submitted</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Loading results...</td></tr> : filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No results found.</td></tr> : filtered.map((result) => <tr key={result.id ?? result.attemptId}><td className="px-4 py-3"><div className="font-medium text-slate-800">{result.employeeName ?? "—"}</div><div className="text-slate-500">{result.employeeId}</div></td><td className="px-4 py-3 text-slate-700">{quizNames.get(result.quizId) ?? result.quizId}</td><td className="px-4 py-3 text-slate-600">{[result.officeName, result.division].filter(Boolean).join(" · ") || "External participant"}</td><td className="px-4 py-3 font-semibold text-slate-800">{result.score} / {result.totalMarks}<div className="text-slate-500">{result.percentage.toFixed(1)}%</div></td><td className="px-4 py-3 text-emerald-700">{result.correctCount}</td><td className="px-4 py-3 text-red-600">{result.wrongCount}</td><td className="px-4 py-3 text-slate-500">{formatTimestamp(result.evaluatedAt ?? result.createdAt) || "—"}</td></tr>)}</tbody></table></div>
  </div></AdminLayout>;
}
