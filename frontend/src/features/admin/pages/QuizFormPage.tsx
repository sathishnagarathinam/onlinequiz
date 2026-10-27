import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Timestamp } from "firebase/firestore";
import AdminLayout from "../components/AdminLayout";
import {
  createQuiz,
  getOfficeMaster,
  getQuiz,
  updateQuiz,
} from "../../../shared/services/firestoreApi";
import { writeAuditLog } from "../../../shared/services/functionsApi";
import { useAuthCtx } from "../../auth/context/AuthContext";
import type { Quiz } from "../../../shared/types/firestore";
import { cn, timestampToLocalInput } from "../../../shared/utils/ui";

const schema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  durationMinutes: z.coerce
    .number()
    .int("Duration must be an integer")
    .positive("Duration must be positive"),
  totalMarks: z.coerce
    .number()
    .int("Total marks must be an integer")
    .positive("Total marks must be positive"),
  negativeMarking: z.boolean(),
  negativeMarkValue: z.coerce.number().optional(),
  numQuestionsToShow: z.coerce
    .number()
    .int("Number of questions must be an integer")
    .positive("Number of questions must be positive"),
  targetOffice: z.string().optional(),
  targetDivision: z.string().optional(),
  openTime: z.string().min(1, "Open time is required"),
  closeTime: z.string().min(1, "Close time is required"),
  resultsPublishAt: z.string().optional(),
  rankPublishAt: z.string().optional(),
});

type QuizForm = z.infer<typeof schema>;

export default function QuizFormPage() {
  const navigate = useNavigate();
  const { adminIdentity } = useAuthCtx();
  const { quizId } = useParams<{ quizId: string }>();
  const [searchParams] = useSearchParams();
  const queryQuizId = searchParams.get("quizId");
  const effectiveQuizId = quizId || queryQuizId;
  const isEdit = !!effectiveQuizId && effectiveQuizId !== "new";

  const [offices, setOffices] = useState<string[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<QuizForm>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      name: "",
      description: "",
      durationMinutes: 30,
      totalMarks: 100,
      negativeMarking: false,
      negativeMarkValue: 0.25,
      numQuestionsToShow: 20,
      targetOffice: "",
      targetDivision: "",
      openTime: "",
      closeTime: "",
      resultsPublishAt: "",
      rankPublishAt: "",
    },
  });

  const negativeMarking = watch("negativeMarking");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const officeMaster = await getOfficeMaster();
        if (officeMaster) {
          setOffices(officeMaster.offices || []);
          setDivisions(officeMaster.divisions || []);
        }

        if (isEdit && effectiveQuizId) {
          const quiz = await getQuiz(effectiveQuizId);
          if (quiz) {
            reset({
              name: quiz.name,
              description: quiz.description ?? "",
              durationMinutes: quiz.durationMinutes,
              totalMarks: quiz.totalMarks,
              negativeMarking: quiz.negativeMarking,
              negativeMarkValue: quiz.negativeMarkValue ?? 0.25,
              numQuestionsToShow: quiz.numQuestionsToShow,
              targetOffice: quiz.targetOffice ?? "",
              targetDivision: quiz.targetDivision ?? "",
              openTime: timestampToLocalInput(quiz.openTime),
              closeTime: timestampToLocalInput(quiz.closeTime),
              resultsPublishAt: timestampToLocalInput(quiz.resultsPublishAt),
              rankPublishAt: timestampToLocalInput(quiz.rankPublishAt),
            });
          }
        }
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, [isEdit, effectiveQuizId, reset]);

  const onSubmit = async (data: QuizForm) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const basePayload: Omit<Quiz, "id" | "createdAt" | "createdBy" | "updatedAt"> = {
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        durationMinutes: data.durationMinutes,
        totalMarks: data.totalMarks,
        negativeMarking: data.negativeMarking,
        negativeMarkValue: data.negativeMarking ? data.negativeMarkValue ?? 0 : 0,
        numQuestionsToShow: data.numQuestionsToShow,
        targetOffice: data.targetOffice || undefined,
        targetDivision: data.targetDivision || undefined,
        openTime: Timestamp.fromDate(new Date(data.openTime)),
        closeTime: Timestamp.fromDate(new Date(data.closeTime)),
        // Blank clears the schedule; a time makes results/rank auto-publish then.
        resultsPublishAt: data.resultsPublishAt
          ? Timestamp.fromDate(new Date(data.resultsPublishAt))
          : null,
        rankPublishAt: data.rankPublishAt
          ? Timestamp.fromDate(new Date(data.rankPublishAt))
          : null,
      };

      const adminUid = adminIdentity?.uid ?? "";
      const adminEmail = adminIdentity?.email ?? undefined;

      if (isEdit && effectiveQuizId) {
        await updateQuiz(effectiveQuizId, basePayload);
        await writeAuditLog({
          action: "quiz.edit",
          adminUid,
          adminEmail,
          payload: {
            quizId: effectiveQuizId,
            patches: basePayload,
          },
        });
      } else {
        const newId = await createQuiz({
          ...basePayload,
          forceClosed: false,
          resultsPublished: false,
          rankListPublished: false,
          createdBy: "admin",
        });
        await writeAuditLog({
          action: "quiz.create",
          adminUid,
          adminEmail,
          payload: {
            quizId: newId,
            name: basePayload.name,
          },
        });
      }

      navigate("/admin/quizzes");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save quiz";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-900" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-slate-900">
            {isEdit ? "Edit Quiz" : "Create New Quiz"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isEdit ? "Update the quiz details below" : "Fill in the details to create a new quiz"}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="bg-white rounded-lg border border-brand-100 p-5 shadow-sm space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Quiz Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register("name")}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-sm outline-none transition",
                  "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600",
                  errors.name ? "border-red-400" : "border-slate-300"
                )}
                placeholder="e.g. Q3 General Knowledge"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                rows={3}
                {...register("description")}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-sm outline-none transition resize-y",
                  "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600",
                  errors.description ? "border-red-400" : "border-slate-300"
                )}
                placeholder="Optional description for this quiz..."
              />
              {errors.description && (
                <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Duration (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  {...register("durationMinutes")}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-sm outline-none transition",
                    "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600",
                    errors.durationMinutes ? "border-red-400" : "border-slate-300"
                  )}
                />
                {errors.durationMinutes && (
                  <p className="mt-1 text-xs text-red-500">{errors.durationMinutes.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Total Marks <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  {...register("totalMarks")}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-sm outline-none transition",
                    "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600",
                    errors.totalMarks ? "border-red-400" : "border-slate-300"
                  )}
                />
                {errors.totalMarks && (
                  <p className="mt-1 text-xs text-red-500">{errors.totalMarks.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Questions to Show <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                {...register("numQuestionsToShow")}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-sm outline-none transition",
                  "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600",
                  errors.numQuestionsToShow ? "border-red-400" : "border-slate-300"
                )}
              />
              {errors.numQuestionsToShow && (
                <p className="mt-1 text-xs text-red-500">{errors.numQuestionsToShow.message}</p>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Enable Negative Marking</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    {...register("negativeMarking")}
                  />
                  <div
                    className={cn(
                      "w-9 h-5 rounded-full peer transition-colors",
                      "peer-checked:bg-brand-700 bg-slate-200",
                      "after:content-[''] after:absolute after:top-0.5 after:left-0.5",
                      "after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all",
                      "peer-checked:after:translate-x-4"
                    )}
                  />
                </label>
              </div>

              {negativeMarking && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Negative Mark Value <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    {...register("negativeMarkValue")}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-sm outline-none transition",
                      "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600",
                      errors.negativeMarkValue ? "border-red-400" : "border-slate-300"
                    )}
                  />
                  {errors.negativeMarkValue && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.negativeMarkValue.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-brand-100 p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Targeting</h2>
            <p className="text-xs text-slate-500 -mt-2">
              Leave blank to make available to all employees
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Office</label>
                <select
                  {...register("targetOffice")}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-sm outline-none transition bg-white",
                    "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600",
                    errors.targetOffice ? "border-red-400" : "border-slate-300"
                  )}
                >
                  <option value="">All offices</option>
                  {offices.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                {errors.targetOffice && (
                  <p className="mt-1 text-xs text-red-500">{errors.targetOffice.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Division</label>
                <select
                  {...register("targetDivision")}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-sm outline-none transition bg-white",
                    "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600",
                    errors.targetDivision ? "border-red-400" : "border-slate-300"
                  )}
                >
                  <option value="">All divisions</option>
                  {divisions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {errors.targetDivision && (
                  <p className="mt-1 text-xs text-red-500">{errors.targetDivision.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-brand-100 p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Schedule</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Open Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  {...register("openTime")}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-sm outline-none transition",
                    "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600",
                    errors.openTime ? "border-red-400" : "border-slate-300"
                  )}
                />
                {errors.openTime && (
                  <p className="mt-1 text-xs text-red-500">{errors.openTime.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Close Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  {...register("closeTime")}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-sm outline-none transition",
                    "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600",
                    errors.closeTime ? "border-red-400" : "border-slate-300"
                  )}
                />
                {errors.closeTime && (
                  <p className="mt-1 text-xs text-red-500">{errors.closeTime.message}</p>
                )}
              </div>
            </div>

            <div className="pt-1">
              <p className="text-xs text-slate-500">
                Leave the publish times blank to publish manually. If set,
                results / rank list become visible to employees automatically at
                that time.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Results Publish At
                </label>
                <input
                  type="datetime-local"
                  {...register("resultsPublishAt")}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-sm outline-none transition",
                    "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600",
                    errors.resultsPublishAt ? "border-red-400" : "border-slate-300"
                  )}
                />
                {errors.resultsPublishAt && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.resultsPublishAt.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Rank Publish At
                </label>
                <input
                  type="datetime-local"
                  {...register("rankPublishAt")}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-sm outline-none transition",
                    "focus:ring-2 focus:ring-slate-900/20 focus:border-brand-600",
                    errors.rankPublishAt ? "border-red-400" : "border-slate-300"
                  )}
                />
                {errors.rankPublishAt && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.rankPublishAt.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {submitError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate("/admin/quizzes")}
              className={cn(
                "rounded-md border border-brand-100 bg-white px-4 py-2 text-sm font-medium",
                "text-slate-700 transition hover:bg-brand-50"
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "rounded-md bg-brand-700 text-white px-4 py-2 text-sm font-medium transition",
                "hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {submitting
                ? "Saving..."
                : isEdit
                ? "Save Changes"
                : "Create Quiz"}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
