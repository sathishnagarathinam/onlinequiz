import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";
import { useAuthState } from "../../../shared/hooks/useAuthState";
import { useAuthCtx } from "../../auth/context/AuthContext";
import { getQuiz, setQuestions } from "../../../shared/services/firestoreApi";
import { writeAuditLog } from "../../../shared/services/functionsApi";
import {
  arrayBufferToWorkbook,
  readFirstSheet,
  validateQuestionRows,
  questionRowErrorsCount,
} from "../../../shared/utils/excel";
import { cn } from "../../../shared/utils/ui";
import type { Question, QuestionImportRow } from "../../../shared/types/firestore";

export default function QuestionUploadPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { dbUser } = useAuthState();
  const { adminIdentity } = useAuthCtx();

  const [quizName, setQuizName] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<QuestionImportRow[]>([]);
  const [parsed, setParsed] = useState(false);
  const [replaceAll, setReplaceAll] = useState(true);
  const [importValidOnly, setImportValidOnly] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!quizId) return;
    getQuiz(quizId).then((q) => q && setQuizName(q.name));
  }, [quizId]);

  const stats = useMemo(() => {
    const total = rows.length;
    const invalid = questionRowErrorsCount(rows);
    const valid = total - invalid;
    return { total, valid, invalid };
  }, [rows]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quizId) return;
    setFileName(file.name);
    setError("");
    setParsed(false);
    try {
      const buf = await file.arrayBuffer();
      const wb = arrayBufferToWorkbook(buf);
      const raw = readFirstSheet<QuestionImportRow>(wb);
      const validated = validateQuestionRows(raw);
      setRows(validated);
      setParsed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  const handleImport = async () => {
    if (!quizId || importing) return;
    const rowsToImport = importValidOnly
      ? rows.filter((r) => r._valid)
      : rows;
    if (rowsToImport.length === 0) {
      setError("No valid rows to import");
      return;
    }
    setImporting(true);
    setError("");
    try {
      const questions: Question[] = rowsToImport.map((r) => ({
        question: String(r.Question).trim(),
        optionA: String(r["Option A"]).trim(),
        optionB: String(r["Option B"]).trim(),
        optionC: String(r["Option C"]).trim(),
        optionD: String(r["Option D"]).trim(),
        correctAnswer: String(r["Correct Answer"]).trim().toUpperCase() as
          | "A"
          | "B"
          | "C"
          | "D",
        marks: Number(r.Marks),
        explanation: r.Explanation ? String(r.Explanation).trim() : "",
      }));
      await setQuestions(quizId, questions, replaceAll);
      await writeAuditLog({
        action: replaceAll ? "question.replace" : "question.import",
        adminUid: adminIdentity?.uid ?? dbUser?.uid ?? "",
        adminEmail: adminIdentity?.email ?? dbUser?.email,
        payload: { quizId, count: questions.length },
      });
      alert(`Successfully imported ${questions.length} questions.`);
      navigate("/admin/quizzes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900 break-words">
              Upload Questions — {quizName || "Loading..."}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Upload an Excel file (.xlsx, .xls) with questions
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/quizzes")}
            className="self-start sm:self-auto shrink-0 px-3 py-2 text-sm rounded-md border border-brand-100 bg-white text-slate-700 hover:bg-brand-50"
          >
            ← Back to Quizzes
          </button>
        </div>

        <section className="bg-white rounded-lg border border-brand-100 p-4 sm:p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-3">
            Step 1: Choose File
          </h2>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-brand-700 file:text-white hover:file:bg-brand-600"
          />
          {fileName && (
            <p className="mt-2 text-sm text-slate-500">Selected: {fileName}</p>
          )}
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </section>

        {parsed && (
          <section className="bg-white rounded-lg border border-brand-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-brand-100">
              <h2 className="text-base font-semibold text-slate-900 mb-2">
                Step 2 &amp; 3: Preview &amp; Validation
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="text-slate-600">
                  Total rows: <strong className="text-slate-900">{stats.total}</strong>
                </span>
                <span className="text-slate-600">
                  Valid: <strong className="text-emerald-700">{stats.valid}</strong>
                </span>
                <span className="text-slate-600">
                  Invalid: <strong className="text-red-700">{stats.invalid}</strong>
                </span>
                {stats.invalid > 0 && (
                  <span className="text-red-600 font-medium">
                    Validation errors — correct the file before import
                  </span>
                )}
              </div>
              {stats.invalid > 0 && (
                <label className="flex items-center gap-2 mt-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={importValidOnly}
                    onChange={(e) => setImportValidOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Import valid rows only (skip invalid)
                </label>
              )}
            </div>

            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-50 text-slate-500 text-left sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-medium w-12">#</th>
                    <th className="px-4 py-3 font-medium min-w-[240px]">Question</th>
                    <th className="px-4 py-3 font-medium min-w-[140px]">A</th>
                    <th className="px-4 py-3 font-medium min-w-[140px]">B</th>
                    <th className="px-4 py-3 font-medium min-w-[140px]">C</th>
                    <th className="px-4 py-3 font-medium min-w-[140px]">D</th>
                    <th className="px-4 py-3 font-medium w-20">Correct</th>
                    <th className="px-4 py-3 font-medium w-20">Marks</th>
                    <th className="px-4 py-3 font-medium min-w-[220px]">Explanation</th>
                    <th className="px-4 py-3 font-medium min-w-[200px]">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={cn(
                        !row._valid && "bg-red-50 text-red-800"
                      )}
                    >
                      <td className="px-4 py-3 align-top">{i + 1}</td>
                      <td className="px-4 py-3 align-top">{row.Question}</td>
                      <td className="px-4 py-3 align-top">{row["Option A"]}</td>
                      <td className="px-4 py-3 align-top">{row["Option B"]}</td>
                      <td className="px-4 py-3 align-top">{row["Option C"]}</td>
                      <td className="px-4 py-3 align-top">{row["Option D"]}</td>
                      <td className="px-4 py-3 align-top font-medium">
                        {row["Correct Answer"]}
                      </td>
                      <td className="px-4 py-3 align-top">{row.Marks}</td>
                      <td className="px-4 py-3 align-top">{row.Explanation}</td>
                      <td className="px-4 py-3 align-top text-red-700">
                        {row._errors?.join(" | ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {parsed && (
          <section className="bg-white rounded-lg border border-brand-100 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              Step 4: Import
            </h2>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={replaceAll}
                  onChange={(e) => setReplaceAll(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Replace all existing questions in this quiz
              </label>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleImport}
                  disabled={importing || stats.valid === 0}
                  className="px-5 py-2.5 rounded-md bg-brand-700 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? "Importing..." : "Confirm Import"}
                </button>
                <button
                  onClick={() => navigate("/admin/quizzes")}
                  className="px-4 py-2.5 rounded-md border border-brand-100 bg-white text-sm text-slate-700 hover:bg-brand-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
