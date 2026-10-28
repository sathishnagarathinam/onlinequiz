import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import AdminLayout from "../components/AdminLayout";
import {
  getQuiz,
  listQuestions,
  updateQuestion,
  deleteQuestion,
} from "../../../shared/services/firestoreApi";
import { TEMPLATE_CONSTANTS } from "../../../shared/utils/excel";
import { downloadBlob } from "../../../shared/utils/ui";
import type { Question } from "../../../shared/types/firestore";

interface EditableQuestion extends Question {
  _dirty?: boolean;
}

export default function QuestionBankPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [quizName, setQuizName] = useState<string>("");
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!quizId) return;
    Promise.all([getQuiz(quizId), listQuestions(quizId)])
      .then(([q, qs]) => {
        if (q) setQuizName(q.name);
        setQuestions(qs);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [quizId]);

  const handleFieldChange = (
    id: string,
    field: keyof Question,
    value: string | number
  ) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id ? { ...q, [field]: value, _dirty: true } : q
      )
    );
  };

  const handleSave = async (q: EditableQuestion) => {
    if (!quizId || !q.id || savingId) return;
    setSavingId(q.id);
    setError("");
    try {
      const patch: Partial<Question> = {
        question: q.question,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: q.correctAnswer,
        marks: Number(q.marks),
        explanation: q.explanation,
      };
      await updateQuestion(quizId, q.id, patch);
      setQuestions((prev) =>
        prev.map((x) => (x.id === q.id ? { ...x, ...patch, _dirty: false } : x))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (q: EditableQuestion) => {
    if (!quizId || !q.id || deletingId) return;
    if (!confirm(`Delete this question?`)) return;
    setDeletingId(q.id);
    setError("");
    try {
      await deleteQuestion(quizId, q.id);
      setQuestions((prev) => prev.filter((x) => x.id !== q.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = TEMPLATE_CONSTANTS.QUESTION_HEADERS;
    const sampleRow = [
      "What is the capital of France?",
      "London",
      "Paris",
      "Berlin",
      "Madrid",
      "B",
      2,
      "Geography",
    ];
    const aoa = [headers, sampleRow];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, "question-template.xlsx");
  };

  const inputCls =
    "w-full px-2 py-1.5 text-sm border border-brand-100 rounded bg-white focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-brand-300";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900 break-words">
              Question Bank — {quizName || "Loading..."}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {questions.length} question{questions.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-2 text-sm rounded-md border border-brand-100 bg-white text-slate-700 hover:bg-brand-50"
            >
              ↓ Download Questions Template
            </button>
            {quizId && (
              <button
                onClick={() =>
                  navigate(`/admin/quizzes/${quizId}/questions/upload`)
                }
                className="px-3 py-2 text-sm rounded-md bg-brand-700 text-white hover:bg-brand-700"
              >
                ↑ Upload More
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <section className="bg-white rounded-lg border border-brand-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">
              Loading questions...
            </div>
          ) : questions.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-slate-500 text-sm">No questions yet.</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={handleDownloadTemplate}
                  className="px-3 py-2 text-sm rounded-md border border-brand-100 bg-white text-slate-700 hover:bg-brand-50"
                >
                  Download Template
                </button>
                {quizId && (
                  <button
                    onClick={() =>
                      navigate(`/admin/quizzes/${quizId}/questions/upload`)
                    }
                    className="px-3 py-2 text-sm rounded-md bg-brand-700 text-white hover:bg-brand-700"
                  >
                    Upload Questions
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-50 text-slate-500 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium w-12">#</th>
                    <th className="px-4 py-3 font-medium min-w-[260px]">Question</th>
                    <th className="px-4 py-3 font-medium min-w-[140px]">A</th>
                    <th className="px-4 py-3 font-medium min-w-[140px]">B</th>
                    <th className="px-4 py-3 font-medium min-w-[140px]">C</th>
                    <th className="px-4 py-3 font-medium min-w-[140px]">D</th>
                    <th className="px-4 py-3 font-medium w-28">Correct</th>
                    <th className="px-4 py-3 font-medium w-24">Marks</th>
                    <th className="px-4 py-3 font-medium min-w-[220px]">Explanation</th>
                    <th className="px-4 py-3 font-medium w-36 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {questions.map((q, i) => (
                    <tr key={q.id ?? i} className={q._dirty ? "bg-amber-50/40" : ""}>
                      <td className="px-4 py-3 align-top">{i + 1}</td>
                      <td className="px-4 py-3 align-top">
                        <textarea
                          value={q.question}
                          onChange={(e) =>
                            handleFieldChange(q.id!, "question", e.target.value)
                          }
                          rows={2}
                          className={inputCls}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="text"
                          value={q.optionA}
                          onChange={(e) =>
                            handleFieldChange(q.id!, "optionA", e.target.value)
                          }
                          className={inputCls}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="text"
                          value={q.optionB}
                          onChange={(e) =>
                            handleFieldChange(q.id!, "optionB", e.target.value)
                          }
                          className={inputCls}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="text"
                          value={q.optionC}
                          onChange={(e) =>
                            handleFieldChange(q.id!, "optionC", e.target.value)
                          }
                          className={inputCls}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="text"
                          value={q.optionD}
                          onChange={(e) =>
                            handleFieldChange(q.id!, "optionD", e.target.value)
                          }
                          className={inputCls}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <select
                          value={q.correctAnswer}
                          onChange={(e) =>
                            handleFieldChange(
                              q.id!,
                              "correctAnswer",
                              e.target.value as "A" | "B" | "C" | "D"
                            )
                          }
                          className={inputCls}
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={q.marks}
                          onChange={(e) =>
                            handleFieldChange(q.id!, "marks", Number(e.target.value))
                          }
                          className={inputCls}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <textarea
                          value={q.explanation ?? ""}
                          onChange={(e) =>
                            handleFieldChange(q.id!, "explanation", e.target.value)
                          }
                          rows={2}
                          className={inputCls}
                          placeholder="Why this answer is correct"
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSave(q)}
                            disabled={savingId === q.id}
                            className="px-3 py-1.5 text-xs rounded bg-brand-700 text-white hover:bg-brand-700 disabled:opacity-50"
                          >
                            {savingId === q.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => handleDelete(q)}
                            disabled={deletingId === q.id}
                            className="px-3 py-1.5 text-xs rounded border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            {deletingId === q.id ? "..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
