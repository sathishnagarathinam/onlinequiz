import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { listAuditLogs } from "../../../shared/services/functionsApi";
import { cn, formatTimestamp } from "../../../shared/utils/ui";
import type { AuditLog } from "../../../shared/types/firestore";

const ALL_ACTIONS: Array<AuditLog["action"] | "all"> = [
  "all",
  "question.import",
  "question.replace",
  "quiz.create",
  "quiz.edit",
  "quiz.delete",
  "quiz.forceClose",
  "results.publish",
  "results.unpublish",
  "results.adjust",
  "rank.publish",
  "rank.unpublish",
  "employee.import",
  "employee.edit",
  "admin.login",
  "settings.update",
];

const ACTION_COLORS: Record<string, string> = {
  "question.import": "bg-pink-100 text-pink-700 border-pink-200",
  "question.replace": "bg-pink-100 text-pink-700 border-pink-200",
  "employee.import": "bg-pink-100 text-pink-700 border-pink-200",
  "results.publish": "bg-green-100 text-green-700 border-green-200",
  "rank.publish": "bg-green-100 text-green-700 border-green-200",
  "results.unpublish": "bg-orange-100 text-orange-700 border-orange-200",
  "rank.unpublish": "bg-orange-100 text-orange-700 border-orange-200",
  "quiz.forceClose": "bg-red-100 text-red-700 border-red-200",
  "quiz.delete": "bg-red-100 text-red-700 border-red-200",
  "quiz.edit": "bg-brand-50 text-brand-700 border-brand-200",
  "results.adjust": "bg-brand-50 text-brand-700 border-brand-200",
  "employee.edit": "bg-brand-50 text-brand-700 border-brand-200",
  "quiz.create": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "admin.login": "bg-brand-50 text-slate-700 border-brand-100",
  "settings.update": "bg-violet-100 text-violet-700 border-violet-200",
};

function getActionColor(action: string): string {
  return ACTION_COLORS[action] ?? "bg-brand-50 text-slate-700 border-brand-100";
}

function formatPayload(payload: unknown): string {
  if (!payload) return "—";
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<Array<{ id: string } & AuditLog>>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<AuditLog["action"] | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await listAuditLogs(500);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (dateFrom || dateTo) {
        let logDate: Date | null = null;
        try {
          if (typeof log.timestamp === "object" && log.timestamp != null && "toDate" in log.timestamp) {
            logDate = (log.timestamp as { toDate: () => Date }).toDate();
          } else if (log.timestamp) {
            logDate = new Date(log.timestamp as string | number);
          }
        } catch {
          logDate = null;
        }
        if (logDate) {
          if (dateFrom) {
            const from = new Date(dateFrom + "T00:00:00");
            if (logDate < from) return false;
          }
          if (dateTo) {
            const to = new Date(dateTo + "T23:59:59");
            if (logDate > to) return false;
          }
        }
      }
      return true;
    });
  }, [logs, actionFilter, dateFrom, dateTo]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Audit Log</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Complete audit trail of all admin actions
            </p>
          </div>
          <button
            onClick={() => void loadLogs()}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-brand-100 bg-white",
              "px-3 py-2 text-xs font-medium text-slate-700 transition",
              "hover:bg-brand-50 disabled:opacity-50"
            )}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        <div className="bg-white rounded-lg border border-brand-100 p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Action
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as AuditLog["action"] | "all")}
                className="w-full px-3 py-2 rounded-md border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
              >
                {ALL_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a === "all" ? "All Actions" : a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
              />
            </div>
            <div>
              <button
                onClick={() => {
                  setActionFilter("all");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="w-full px-3 py-2 rounded-md border border-brand-100 bg-brand-50 text-xs font-medium text-slate-700 hover:bg-brand-50 transition"
              >
                Clear Filters
              </button>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            {loading ? "Loading..." : `Showing ${filteredLogs.length} of ${logs.length} entries`}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-brand-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-340px)] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-brand-50 text-slate-500 text-left sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 font-medium w-12">#</th>
                  <th className="px-4 py-2.5 font-medium w-44">Timestamp</th>
                  <th className="px-4 py-2.5 font-medium w-40">Action</th>
                  <th className="px-4 py-2.5 font-medium w-56">Admin</th>
                  <th className="px-4 py-2.5 font-medium">Payload</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-100 border-t-slate-700" />
                        Loading audit logs...
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-slate-400">
                      No audit logs match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, i) => (
                    <tr
                      key={log.id}
                      className={cn(
                        i % 2 === 0 ? "bg-white" : "bg-gray-50",
                        "border-t border-slate-100"
                      )}
                    >
                      <td className="px-4 py-2.5 text-slate-500 font-mono align-top">
                        {i + 1}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 align-top whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                            getActionColor(log.action)
                          )}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <div className="text-slate-900 font-medium truncate" title={log.adminEmail}>
                          {log.adminEmail ?? "—"}
                        </div>
                        <div className="text-slate-400 font-mono text-[10px] truncate" title={log.adminUid}>
                          {log.adminUid}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <div className="bg-brand-50 rounded border border-brand-100 p-2 font-mono text-[10px] text-slate-700 max-w-xl max-h-36 overflow-auto whitespace-pre-wrap break-all">
                          {formatPayload(log.payload)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
