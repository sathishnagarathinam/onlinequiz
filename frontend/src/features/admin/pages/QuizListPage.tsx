import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import AdminLayout from "../components/AdminLayout";
import { useAuthCtx } from "../../auth/context/AuthContext";
import {
  deleteQuiz,
  listQuizzes,
  publishRankForQuiz,
  publishResultsForQuiz,
  updateQuiz,
} from "../../../shared/services/firestoreApi";
import { writeAuditLog } from "../../../shared/services/functionsApi";
import type { Quiz } from "../../../shared/types/firestore";
import { cn, formatTimestamp, timestampToLocalInput } from "../../../shared/utils/ui";

interface DialogState {
  open: boolean;
  quizId?: string;
  quizName?: string;
}

export default function QuizListPage() {
  const navigate = useNavigate();
  const { adminIdentity } = useAuthCtx();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [forceCloseDialog, setForceCloseDialog] = useState<DialogState>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<DialogState>({ open: false });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const data = await listQuizzes();
      setQuizzes(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQuizzes();
  }, []);

  const handleForceClose = async () => {
    if (!forceCloseDialog.quizId) return;
    setActionLoading(`force-${forceCloseDialog.quizId}`);
    try {
      await updateQuiz(forceCloseDialog.quizId, { forceClosed: true });
      const adminUid = adminIdentity?.uid ?? "";
      const adminEmail = adminIdentity?.email ?? undefined;
      await writeAuditLog({
        action: "quiz.forceClose",
        adminUid,
        adminEmail,
        payload: {
          quizId: forceCloseDialog.quizId,
          name: forceCloseDialog.quizName,
        },
      });
      setQuizzes((prev) =>
        prev.map((q) =>
          q.id === forceCloseDialog.quizId ? { ...q, forceClosed: true } : q
        )
      );
      setForceCloseDialog({ open: false });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.quizId) return;
    setActionLoading(`delete-${deleteDialog.quizId}`);
    try {
      await deleteQuiz(deleteDialog.quizId);
      const adminUid = adminIdentity?.uid ?? "";
      const adminEmail = adminIdentity?.email ?? undefined;
      await writeAuditLog({
        action: "quiz.delete",
        adminUid,
        adminEmail,
        payload: {
          quizId: deleteDialog.quizId,
          name: deleteDialog.quizName,
        },
      });
      setQuizzes((prev) => prev.filter((q) => q.id !== deleteDialog.quizId));
      setDeleteDialog({ open: false });
    } finally {
      setActionLoading(null);
    }
  };

  const togglePublishResults = async (quiz: Quiz, publish: boolean) => {
    if (!quiz.id) return;
    setActionLoading(`results-${quiz.id}`);
    try {
      await publishResultsForQuiz(quiz.id, publish);
      const adminUid = adminIdentity?.uid ?? "";
      const adminEmail = adminIdentity?.email ?? undefined;
      await writeAuditLog({
        action: publish ? "results.publish" : "results.unpublish",
        adminUid,
        adminEmail,
        payload: {
          quizId: quiz.id,
          name: quiz.name,
        },
      });
      setQuizzes((prev) =>
        prev.map((q) =>
          q.id === quiz.id ? { ...q, resultsPublished: publish } : q
        )
      );
    } finally {
      setActionLoading(null);
    }
  };

  const togglePublishRank = async (quiz: Quiz, publish: boolean) => {
    if (!quiz.id) return;
    setActionLoading(`rank-${quiz.id}`);
    try {
      await publishRankForQuiz(quiz.id, publish);
      const adminUid = adminIdentity?.uid ?? "";
      const adminEmail = adminIdentity?.email ?? undefined;
      await writeAuditLog({
        action: publish ? "rank.publish" : "rank.unpublish",
        adminUid,
        adminEmail,
        payload: {
          quizId: quiz.id,
          name: quiz.name,
        },
      });
      setQuizzes((prev) =>
        prev.map((q) =>
          q.id === quiz.id ? { ...q, rankListPublished: publish } : q
        )
      );
    } finally {
      setActionLoading(null);
    }
  };

  /** Save the auto-publish time for results / rank list (blank clears it). */
  const savePublishTime = async (
    quiz: Quiz,
    field: "resultsPublishAt" | "rankPublishAt",
    value: string
  ) => {
    if (!quiz.id) return;
    const at = value ? Timestamp.fromDate(new Date(value)) : null;
    setActionLoading(`${field}-${quiz.id}`);
    try {
      await updateQuiz(quiz.id, { [field]: at });
      const adminUid = adminIdentity?.uid ?? "";
      const adminEmail = adminIdentity?.email ?? undefined;
      await writeAuditLog({
        action: field === "resultsPublishAt" ? "results.schedule" : "rank.schedule",
        adminUid,
        adminEmail,
        payload: { quizId: quiz.id, name: quiz.name, at: value || null },
      });
      setQuizzes((prev) =>
        prev.map((q) => (q.id === quiz.id ? { ...q, [field]: at } : q))
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900">Quizzes</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage quizzes, questions, and publishing settings
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/quizzes/new")}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 shrink-0",
              "text-sm font-medium text-white transition hover:bg-brand-700"
            )}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Quiz
          </button>
        </div>

        <div className="bg-white rounded-lg border border-brand-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-50 text-slate-500 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 font-medium">Open</th>
                  <th className="px-5 py-3 font-medium">Close</th>
                  <th className="px-5 py-3 font-medium">Target Office</th>
                  <th className="px-5 py-3 font-medium">Target Division</th>
                  <th className="px-5 py-3 font-medium">Force Closed</th>
                  <th className="px-5 py-3 font-medium">Results Published</th>
                  <th className="px-5 py-3 font-medium">Rank Published</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-10 text-center text-slate-400">
                      Loading quizzes...
                    </td>
                  </tr>
                ) : quizzes.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-10 text-center text-slate-400">
                      No quizzes yet. Create your first quiz.
                    </td>
                  </tr>
                ) : (
                  quizzes.map((quiz) => (
                    <tr
                      key={quiz.id}
                      className={cn(
                        "transition-colors",
                        quiz.forceClosed
                          ? "bg-red-50 hover:bg-red-100/60"
                          : "hover:bg-brand-50"
                      )}
                    >
                      <td className="px-5 py-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {quiz.forceClosed && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              Closed
                            </span>
                          )}
                          {quiz.name}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{quiz.durationMinutes}m</td>
                      <td className="px-5 py-3 text-slate-600">{formatTimestamp(quiz.openTime)}</td>
                      <td className="px-5 py-3 text-slate-600">{formatTimestamp(quiz.closeTime)}</td>
                      <td className="px-5 py-3 text-slate-600">{quiz.targetOffice || "—"}</td>
                      <td className="px-5 py-3 text-slate-600">{quiz.targetDivision || "—"}</td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            quiz.forceClosed
                              ? "bg-red-100 text-red-700"
                              : "bg-brand-50 text-slate-600"
                          )}
                        >
                          {quiz.forceClosed ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={!!quiz.resultsPublished}
                            disabled={actionLoading === `results-${quiz.id}`}
                            onChange={(e) => void togglePublishResults(quiz, e.target.checked)}
                          />
                          <div
                            className={cn(
                              "w-9 h-5 rounded-full peer transition-colors",
                              "peer-checked:bg-brand-700 bg-slate-200",
                              "after:content-[''] after:absolute after:top-0.5 after:left-0.5",
                              "after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all",
                              "peer-checked:after:translate-x-4 peer-disabled:opacity-50"
                            )}
                          />
                        </label>
                        <input
                          type="datetime-local"
                          title="Auto-publish results at this time"
                          value={timestampToLocalInput(quiz.resultsPublishAt)}
                          disabled={
                            !!quiz.resultsPublished ||
                            actionLoading === `resultsPublishAt-${quiz.id}`
                          }
                          onChange={(e) =>
                            void savePublishTime(quiz, "resultsPublishAt", e.target.value)
                          }
                          className={cn(
                            "mt-2 block w-40 rounded border border-slate-300 px-1.5 py-1 text-[11px]",
                            "text-slate-700 outline-none focus:border-brand-600 focus:ring-1",
                            "focus:ring-brand-400 disabled:bg-brand-50 disabled:text-slate-400"
                          )}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={!!quiz.rankListPublished}
                            disabled={actionLoading === `rank-${quiz.id}`}
                            onChange={(e) => void togglePublishRank(quiz, e.target.checked)}
                          />
                          <div
                            className={cn(
                              "w-9 h-5 rounded-full peer transition-colors",
                              "peer-checked:bg-brand-700 bg-slate-200",
                              "after:content-[''] after:absolute after:top-0.5 after:left-0.5",
                              "after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all",
                              "peer-checked:after:translate-x-4 peer-disabled:opacity-50"
                            )}
                          />
                        </label>
                        <input
                          type="datetime-local"
                          title="Auto-publish rank list at this time"
                          value={timestampToLocalInput(quiz.rankPublishAt)}
                          disabled={
                            !!quiz.rankListPublished ||
                            actionLoading === `rankPublishAt-${quiz.id}`
                          }
                          onChange={(e) =>
                            void savePublishTime(quiz, "rankPublishAt", e.target.value)
                          }
                          className={cn(
                            "mt-2 block w-40 rounded border border-slate-300 px-1.5 py-1 text-[11px]",
                            "text-slate-700 outline-none focus:border-brand-600 focus:ring-1",
                            "focus:ring-brand-400 disabled:bg-brand-50 disabled:text-slate-400"
                          )}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/admin/quizzes/${quiz.id}/edit`}
                            className={cn(
                              "inline-flex items-center rounded-md border border-brand-100 bg-white",
                              "px-2.5 py-1.5 text-xs font-medium text-slate-700 transition",
                              "hover:bg-brand-50 hover:border-slate-300"
                            )}
                          >
                            Edit
                          </Link>
                          <Link
                            to={`/admin/quizzes/${quiz.id}/questions`}
                            className={cn(
                              "inline-flex items-center rounded-md border border-brand-100 bg-white",
                              "px-2.5 py-1.5 text-xs font-medium text-slate-700 transition",
                              "hover:bg-brand-50 hover:border-slate-300"
                            )}
                          >
                            Questions
                          </Link>
                          <button
                            onClick={() =>
                              setForceCloseDialog({
                                open: true,
                                quizId: quiz.id,
                                quizName: quiz.name,
                              })
                            }
                            disabled={
                              quiz.forceClosed ||
                              actionLoading === `force-${quiz.id}`
                            }
                            className={cn(
                              "inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition",
                              quiz.forceClosed
                                ? "border-slate-100 bg-brand-50 text-slate-400 cursor-not-allowed"
                                : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300"
                            )}
                          >
                            Force Close
                          </button>
                          <button
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                quizId: quiz.id,
                                quizName: quiz.name,
                              })
                            }
                            disabled={actionLoading === `delete-${quiz.id}`}
                            className={cn(
                              "inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition",
                              "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300"
                            )}
                          >
                            Delete
                          </button>
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

      {forceCloseDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-brand-700/40 backdrop-blur-sm"
            onClick={() => setForceCloseDialog({ open: false })}
          />
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-brand-100">
            <h3 className="text-base font-semibold text-slate-900">Force Close Quiz</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to force close <strong>{forceCloseDialog.quizName}</strong>?
              This will prevent any new attempts from being started. This action cannot be undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setForceCloseDialog({ open: false })}
                className={cn(
                  "rounded-md border border-brand-100 bg-white px-3.5 py-2 text-sm font-medium",
                  "text-slate-700 transition hover:bg-brand-50"
                )}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleForceClose()}
                disabled={actionLoading === `force-${forceCloseDialog.quizId}`}
                className={cn(
                  "rounded-md bg-amber-600 px-3.5 py-2 text-sm font-medium text-white transition",
                  "hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {actionLoading === `force-${forceCloseDialog.quizId}` ? "Closing..." : "Force Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-brand-700/40 backdrop-blur-sm"
            onClick={() => setDeleteDialog({ open: false })}
          />
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-brand-100">
            <h3 className="text-base font-semibold text-slate-900">Delete Quiz</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete <strong>{deleteDialog.quizName}</strong>?
              This will permanently remove the quiz and all associated questions.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteDialog({ open: false })}
                className={cn(
                  "rounded-md border border-brand-100 bg-white px-3.5 py-2 text-sm font-medium",
                  "text-slate-700 transition hover:bg-brand-50"
                )}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={actionLoading === `delete-${deleteDialog.quizId}`}
                className={cn(
                  "rounded-md bg-red-600 px-3.5 py-2 text-sm font-medium text-white transition",
                  "hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {actionLoading === `delete-${deleteDialog.quizId}` ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
