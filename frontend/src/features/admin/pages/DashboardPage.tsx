import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import {
  listUsers,
  listQuizzes,
  listAllResults,
} from "../../../shared/services/firestoreApi";
import { cn, formatTimestamp } from "../../../shared/utils/ui";
import type { FirestoreUser, Quiz, Result } from "../../../shared/types/firestore";

const MOCK_USERS: FirestoreUser[] = [
  { uid: "1", role: "employee", employeeId: "E001", name: "Alice Johnson", officeName: "New York", division: "Sales", designation: "Manager", createdAt: new Date() },
  { uid: "2", role: "employee", employeeId: "E002", name: "Bob Smith", officeName: "New York", division: "Sales", designation: "Executive", createdAt: new Date() },
  { uid: "3", role: "employee", employeeId: "E003", name: "Charlie Lee", officeName: "London", division: "Engineering", designation: "Engineer", createdAt: new Date() },
  { uid: "4", role: "employee", employeeId: "E004", name: "Diana Prince", officeName: "London", division: "Engineering", designation: "Lead Engineer", createdAt: new Date() },
  { uid: "5", role: "employee", employeeId: "E005", name: "Eve Adams", officeName: "Tokyo", division: "HR", designation: "HR Manager", createdAt: new Date() },
  { uid: "6", role: "employee", employeeId: "E006", name: "Frank Miller", officeName: "Tokyo", division: "HR", designation: "Recruiter", createdAt: new Date() },
];

const MOCK_QUIZZES: Quiz[] = [
  { id: "q1", name: "Compliance 101", durationMinutes: 30, totalMarks: 100, negativeMarking: false, negativeMarkValue: 0, numQuestionsToShow: 20, openTime: new Date(), closeTime: new Date(), createdBy: "admin", createdAt: new Date() },
  { id: "q2", name: "Product Knowledge", durationMinutes: 45, totalMarks: 100, negativeMarking: false, negativeMarkValue: 0, numQuestionsToShow: 30, openTime: new Date(), closeTime: new Date(), createdBy: "admin", createdAt: new Date() },
];

const MOCK_RESULTS: Result[] = [
  { id: "r1", attemptId: "a1", uid: "1", employeeId: "E001", employeeName: "Alice Johnson", officeName: "New York", division: "Sales", designation: "Manager", quizId: "q1", score: 85, totalMarks: 100, percentage: 85, correctCount: 17, wrongCount: 2, skippedCount: 1, timeTaken: 1200, published: true, createdAt: new Date(Date.now() - 1000 * 60 * 30) },
  { id: "r2", attemptId: "a2", uid: "2", employeeId: "E002", employeeName: "Bob Smith", officeName: "New York", division: "Sales", designation: "Executive", quizId: "q1", score: 72, totalMarks: 100, percentage: 72, correctCount: 14, wrongCount: 4, skippedCount: 2, timeTaken: 1500, published: true, createdAt: new Date(Date.now() - 1000 * 60 * 60) },
  { id: "r3", attemptId: "a3", uid: "3", employeeId: "E003", employeeName: "Charlie Lee", officeName: "London", division: "Engineering", designation: "Engineer", quizId: "q2", score: 91, totalMarks: 100, percentage: 91, correctCount: 28, wrongCount: 1, skippedCount: 1, timeTaken: 2100, published: true, createdAt: new Date(Date.now() - 1000 * 60 * 90) },
  { id: "r4", attemptId: "a4", uid: "4", employeeId: "E004", employeeName: "Diana Prince", officeName: "London", division: "Engineering", designation: "Lead Engineer", quizId: "q2", score: 88, totalMarks: 100, percentage: 88, correctCount: 27, wrongCount: 2, skippedCount: 1, timeTaken: 2000, published: true, createdAt: new Date(Date.now() - 1000 * 60 * 120) },
  { id: "r5", attemptId: "a5", uid: "5", employeeId: "E005", employeeName: "Eve Adams", officeName: "Tokyo", division: "HR", designation: "HR Manager", quizId: "q1", score: 78, totalMarks: 100, percentage: 78, correctCount: 16, wrongCount: 3, skippedCount: 1, timeTaken: 1400, published: true, createdAt: new Date(Date.now() - 1000 * 60 * 150) },
];

const BAR_COLORS = [
  "bg-brand-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-pink-500",
  "bg-sky-500",
];

function CardSpinner() {
  return (
    <div className="flex items-center justify-center h-16">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-100 border-t-slate-700" />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}

function StatCard({ label, value, sub, loading }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-brand-100 p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-2">
        {loading ? (
          <CardSpinner />
        ) : (
          <>
            <p className="text-2xl font-semibold text-slate-900">{value}</p>
            {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
          </>
        )}
      </div>
    </div>
  );
}

interface BarChartProps {
  title: string;
  data: Record<string, number>;
}

function BarChart({ title, data }: BarChartProps) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return (
      <section className="bg-white rounded-lg border border-brand-100 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-4">{title}</h2>
        <div className="h-64 rounded-md bg-brand-50 border border-dashed border-brand-100 flex items-center justify-center text-sm text-slate-400">
          No data yet
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-lg border border-brand-100 p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900 mb-6">{title}</h2>
      <div className="flex items-end gap-4 justify-start h-40 overflow-x-auto pb-2">
        {entries.map(([key, pct], idx) => {
          const color = BAR_COLORS[idx % BAR_COLORS.length];
          const height = Math.max(2, Math.min(100, pct));
          return (
            <div
              key={key}
              className="flex flex-col items-center gap-2 min-w-[80px] flex-shrink-0"
            >
              <span className="text-xs font-semibold text-slate-700">
                {pct.toFixed(1)}%
              </span>
              <div className="w-full h-32 bg-brand-50 rounded-t-sm flex items-end">
                <div
                  className={cn("w-full rounded-t-sm transition-all", color)}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-600 text-center truncate max-w-[80px]" title={key}>
                {key}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState({
    users: true,
    quizzes: true,
    results: true,
  });

  useEffect(() => {
    listUsers()
      .then((u) => setUsers(u))
      .finally(() => setLoading((l) => ({ ...l, users: false })));
    listQuizzes()
      .then((q) => setQuizzes(q))
      .finally(() => setLoading((l) => ({ ...l, quizzes: false })));
    listAllResults()
      .then((r) => setResults(r))
      .finally(() => setLoading((l) => ({ ...l, results: false })));
  }, []);

  const useMock =
    !loading.users && !loading.quizzes && !loading.results &&
    users.length === 0 && quizzes.length === 0 && results.length === 0;

  const finalUsers = useMock ? MOCK_USERS : users;
  const finalQuizzes = useMock ? MOCK_QUIZZES : quizzes;
  const finalResults = useMock ? MOCK_RESULTS : results;

  const stats = useMemo(() => {
    const employees = finalUsers.filter((u) => u.role === "employee");
    const totalEmployees = employees.length;
    const totalQuizzes = finalQuizzes.length;

    const attemptedSet = new Set<string>();
    let sumPercentage = 0;
    finalResults.forEach((r) => {
      attemptedSet.add(r.employeeId);
      sumPercentage += r.percentage;
    });
    const attemptedUsers = attemptedSet.size;
    const avgScore = finalResults.length > 0
      ? Math.round((sumPercentage / finalResults.length) * 10) / 10
      : 0;
    const pendingUsers = Math.max(0, totalEmployees - attemptedUsers);
    const completionRate = totalEmployees > 0
      ? Math.round((attemptedUsers / totalEmployees) * 1000) / 10
      : 0;

    return {
      totalEmployees,
      totalQuizzes,
      avgScore,
      attemptedUsers,
      pendingUsers,
      completionRate,
    };
  }, [finalUsers, finalQuizzes, finalResults]);

  const officeCompletion = useMemo(() => {
    const byOffice: Record<string, { total: number; attempted: Set<string> }> = {};
    finalUsers
      .filter((u) => u.role === "employee")
      .forEach((u) => {
        const off = u.officeName ?? "Unassigned";
        if (!byOffice[off]) byOffice[off] = { total: 0, attempted: new Set() };
        byOffice[off].total += 1;
      });
    finalResults.forEach((r) => {
      const off = r.officeName ?? "Unassigned";
      if (!byOffice[off]) byOffice[off] = { total: 0, attempted: new Set() };
      byOffice[off].attempted.add(r.employeeId);
    });
    const out: Record<string, number> = {};
    Object.entries(byOffice).forEach(([off, d]) => {
      out[off] = d.total > 0 ? (d.attempted.size / d.total) * 100 : 0;
    });
    return out;
  }, [finalUsers, finalResults]);

  const divisionCompletion = useMemo(() => {
    const byDiv: Record<string, { total: number; attempted: Set<string> }> = {};
    finalUsers
      .filter((u) => u.role === "employee")
      .forEach((u) => {
        const div = u.division ?? "Unassigned";
        if (!byDiv[div]) byDiv[div] = { total: 0, attempted: new Set() };
        byDiv[div].total += 1;
      });
    finalResults.forEach((r) => {
      const div = r.division ?? "Unassigned";
      if (!byDiv[div]) byDiv[div] = { total: 0, attempted: new Set() };
      byDiv[div].attempted.add(r.employeeId);
    });
    const out: Record<string, number> = {};
    Object.entries(byDiv).forEach(([div, d]) => {
      out[div] = d.total > 0 ? (d.attempted.size / d.total) * 100 : 0;
    });
    return out;
  }, [finalUsers, finalResults]);

  const recentResults = useMemo(() => {
    const quizMap: Record<string, string> = {};
    finalQuizzes.forEach((q) => {
      if (q.id) quizMap[q.id] = q.name;
    });
    return finalResults.slice(0, 10).map((r) => ({
      ...r,
      quizName: quizMap[r.quizId] ?? `Quiz ${r.quizId.slice(0, 6)}`,
    }));
  }, [finalResults, finalQuizzes]);

  const anyLoading = loading.users || loading.quizzes || loading.results;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {useMock && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            Showing sample mock data — connect Firestore to see real stats.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Total Employees"
            value={String(stats.totalEmployees)}
            sub="Registered employees"
            loading={loading.users}
          />
          <StatCard
            label="Total Quizzes"
            value={String(stats.totalQuizzes)}
            sub="All-time quizzes"
            loading={loading.quizzes}
          />
          <StatCard
            label="Avg Score %"
            value={`${stats.avgScore.toFixed(1)}%`}
            sub={finalResults.length ? `Across ${finalResults.length} attempts` : "No attempts yet"}
            loading={loading.results}
          />
          <StatCard
            label="Attempted Users"
            value={String(stats.attemptedUsers)}
            sub="Unique employees with at least one result"
            loading={anyLoading}
          />
          <StatCard
            label="Pending Users"
            value={String(stats.pendingUsers)}
            sub="Employees not yet attempted"
            loading={anyLoading}
          />
          <StatCard
            label="Completion Rate"
            value={`${stats.completionRate.toFixed(1)}%`}
            sub="Attempted / total employees"
            loading={anyLoading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BarChart title="Office-wise Completion" data={officeCompletion} />
          <BarChart title="Division-wise Completion" data={divisionCompletion} />
        </div>

        <section className="bg-white rounded-lg border border-brand-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-brand-100">
            <h2 className="text-base font-semibold text-slate-900">Recent Results</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-50 text-slate-500 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">Employee ID</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Quiz</th>
                  <th className="px-5 py-3 font-medium">Score</th>
                  <th className="px-5 py-3 font-medium">%</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {recentResults.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                      No results yet
                    </td>
                  </tr>
                ) : (
                  recentResults.map((r) => (
                    <tr key={r.id} className="hover:bg-brand-50">
                      <td className="px-5 py-3 font-mono text-xs">{r.employeeId}</td>
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {r.employeeName ?? "-"}
                      </td>
                      <td className="px-5 py-3">{r.quizName}</td>
                      <td className="px-5 py-3">
                        {r.score} / {r.totalMarks}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            "font-semibold",
                            r.percentage >= 75
                              ? "text-emerald-600"
                              : r.percentage >= 50
                              ? "text-amber-600"
                              : "text-rose-600"
                          )}
                        >
                          {r.percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">
                        {formatTimestamp(r.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
