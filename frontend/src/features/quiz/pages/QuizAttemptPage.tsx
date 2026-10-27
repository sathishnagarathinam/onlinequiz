import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import { useRequireRole } from "../../../shared/hooks/useAuthState";
import { useAuthCtx } from "../../auth/context/AuthContext";
import { useCountdownTimer } from "../../../shared/hooks/useCountdownTimer";
import {
  getQuiz,
  listQuestions,
  createAttemptWithLock,
  updateAttempt,
  findMyAttempt,
  findCompletedAttempt,
  getResultByAttempt,
  evaluateAttemptClient,
} from "../../../shared/services/firestoreApi";
import { callSubmitQuiz } from "../../../shared/services/functionsApi";
import { seededShuffle, shuffleOptions } from "../../../shared/utils/shuffle";
import { cn } from "../../../shared/utils/ui";
import { EmployeeShell } from "../../auth/components/EmployeeShell";
import type { Quiz, Question, Attempt } from "../../../shared/types/firestore";
import { QuizTimerBar } from "../components/QuizTimerBar";
import { QuizQuestionCard, type DisplayOption } from "../components/QuizQuestionCard";
import { QuizNavButtons } from "../components/QuizNavButtons";

type AnswerKey = "A" | "B" | "C" | "D" | null;
type AnswersMap = Record<string, AnswerKey>;

const DISPLAY_LABELS: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];

function Spinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50">
      <div className="flex flex-col items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 border-4 border-brand-100 border-t-slate-600 rounded-full animate-spin"
          )}
        />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function AlertBanner({
  variant = "info",
  children,
}: {
  variant?: "info" | "warning" | "error" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-brand-50 border-brand-200 text-brand-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    error: "bg-red-50 border-red-200 text-red-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  }[variant];

  return (
    <div className={`border rounded-lg px-5 py-4 ${styles}`}>{children}</div>
  );
}

export function QuizAttemptPage() {
  const { quizId = "" } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { allowed, loading: authLoading, dbUser } = useRequireRole("employee");
  const { employeeIdentity } = useAuthCtx();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [questionOrder, setQuestionOrder] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const saveDebounceRef = useRef<number | null>(null);
  const lastSavedAnswersRef = useRef<AnswersMap>({});
  const submittingRef = useRef(false);

  const questionIdToQuestion = useMemo(() => {
    const m = new Map<string, Question>();
    for (const q of allQuestions) if (q.id) m.set(q.id, q);
    return m;
  }, [allQuestions]);

  const activeQuestionIds = useMemo(
    () => questionOrder,
    [questionOrder]
  );

  const answeredSet = useMemo(() => {
    const s = new Set<string>();
    for (const qid of activeQuestionIds) {
      if (answers[qid]) s.add(qid);
    }
    return s;
  }, [activeQuestionIds, answers]);

  const currentQId = activeQuestionIds[currentIndex] ?? null;
  const currentQuestion = currentQId
    ? questionIdToQuestion.get(currentQId) ?? null
    : null;

  const displayOptions: DisplayOption[] = useMemo(() => {
    if (!currentQuestion || !attempt) return [];
    const opts: Array<{ key: "A" | "B" | "C" | "D"; text: string }> = [
      { key: "A", text: currentQuestion.optionA },
      { key: "B", text: currentQuestion.optionB },
      { key: "C", text: currentQuestion.optionC },
      { key: "D", text: currentQuestion.optionD },
    ];
    const shuffled = shuffleOptions(opts, attempt.seed, currentIndex);
    return shuffled.map((o, i) => ({
      ...o,
      displayLabel: DISPLAY_LABELS[i],
    }));
  }, [currentQuestion, attempt, currentIndex]);

  const initialSeconds = useMemo(
    () => (quiz ? quiz.durationMinutes * 60 : 0),
    [quiz]
  );

  const doSubmit = useCallback(async () => {
    if (!attempt || !attempt.id || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const answersSnapshot: AnswersMap = {};
      for (const qid of activeQuestionIds) {
        answersSnapshot[qid] = answers[qid] ?? null;
      }

      await updateAttempt(attempt.id, {
        status: "completed",
        submittedAt: Timestamp.now(),
        answers: answersSnapshot,
      });

      try {
        await callSubmitQuiz(attempt.id);
      } catch (e) {
        // Functions not deployed / offline: score in the browser so the result
        // still exists for the employee to view.
        console.warn("[quiz] callSubmitQuiz failed — evaluating locally", e);
        try {
          await evaluateAttemptClient(attempt.id);
        } catch (fallbackErr) {
          console.error("[quiz] client-side evaluation failed", fallbackErr);
        }
      }

      navigate(`/employee/pending-results/${quizId}`, { replace: true });
    } catch (e) {
      console.error("[quiz] submit failed", e);
      submittingRef.current = false;
      setSubmitting(false);
      setInitError(e instanceof Error ? e.message : "Failed to submit quiz");
    }
  }, [attempt, activeQuestionIds, answers, navigate, quizId]);

  const timer = useCountdownTimer({
    initialSeconds,
    autoStart: !!quiz && !!attempt && !submitting,
    onExpire: () => {
      void doSubmit();
    },
  });

  useEffect(() => {
    if (authLoading || !allowed || !dbUser || !employeeIdentity || !quizId) return;

    let cancelled = false;

    const empUid = `emp_${employeeIdentity.employeeId}`;

    const init = async () => {
      try {
        const loadedQuiz = await getQuiz(quizId);
        if (cancelled) return;
        if (!loadedQuiz) {
          setInitError("Quiz not found");
          setLoading(false);
          return;
        }
        setQuiz(loadedQuiz);

        const completed = await findCompletedAttempt(
          dbUser.employeeId!,
          quizId
        );
        if (cancelled) return;
        if (completed) {
          let result = await getResultByAttempt(completed.id!);
          if (!result) {
            // Submitted but never scored (Cloud Function unavailable / rejected):
            // score it here so the employee is not stuck without a result.
            const newResultId = await evaluateAttemptClient(completed.id!).catch(
              () => null
            );
            if (newResultId) result = await getResultByAttempt(completed.id!);
          }
          setRedirecting(true);
          const target = result?.id
            ? `/employee/results/${result.id}`
            : `/employee/pending-results/${quizId}`;
          setTimeout(() => {
            navigate(target, { replace: true });
          }, 1500);
          setLoading(false);
          return;
        }

        let existing = await findMyAttempt(empUid, quizId);
        if (cancelled) return;

        let currentAttempt: Attempt;
        if (existing && existing.status === "in_progress") {
          currentAttempt = existing;
        } else {
          const { attemptId: newId } = await createAttemptWithLock({
            uid: empUid,
            employeeId: dbUser.employeeId!,
            quizId,
            seed: Math.floor(Math.random() * 1000000000),
            status: "in_progress",
          });
          const refetched = await findMyAttempt(empUid, quizId);
          if (!refetched) {
            setInitError("Failed to start quiz attempt");
            setLoading(false);
            return;
          }
          currentAttempt = refetched;
          currentAttempt.id = newId;
        }

        setAttempt(currentAttempt);

        if (currentAttempt.answers) {
          setAnswers({ ...currentAttempt.answers });
          lastSavedAnswersRef.current = { ...currentAttempt.answers };
        }

        const questions = await listQuestions(quizId);
        if (cancelled) return;
        setAllQuestions(questions);

        const qIds = questions.filter((q) => q.id).map((q) => q.id!);
        const shuffled = seededShuffle(qIds, currentAttempt.seed);
        const toShow = Math.min(
          loadedQuiz.numQuestionsToShow ?? shuffled.length,
          shuffled.length
        );
        const order = shuffled.slice(0, toShow);
        setQuestionOrder(order);
        setCurrentIndex(0);
      } catch (e) {
        if (cancelled) return;
        console.error("[quiz] init failed", e);
        setInitError(e instanceof Error ? e.message : "Failed to load quiz");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [authLoading, allowed, dbUser, employeeIdentity?.employeeId, quizId, navigate]);

  useEffect(() => {
    if (!attempt?.id || submittingRef.current) return;

    if (saveDebounceRef.current) {
      window.clearTimeout(saveDebounceRef.current);
    }

    const changed = JSON.stringify(answers) !== JSON.stringify(lastSavedAnswersRef.current);
    if (!changed) return;

    saveDebounceRef.current = window.setTimeout(() => {
      const snapshot: AnswersMap = {};
      for (const qid of activeQuestionIds) {
        snapshot[qid] = answers[qid] ?? null;
      }
      lastSavedAnswersRef.current = { ...snapshot };
      updateAttempt(attempt.id!, { answers: snapshot }).catch((e) => {
        console.warn("[quiz] autosave failed", e);
      });
    }, 500);

    return () => {
      if (saveDebounceRef.current) {
        window.clearTimeout(saveDebounceRef.current);
      }
    };
  }, [answers, attempt, activeQuestionIds]);

  const handleSelect = useCallback(
    (key: "A" | "B" | "C" | "D") => {
      if (!currentQId || submittingRef.current) return;
      setAnswers((prev) => ({ ...prev, [currentQId]: key }));
    },
    [currentQId]
  );

  const handleGoTo = useCallback((idx: number) => {
    setCurrentIndex(idx);
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, activeQuestionIds.length - 1));
  }, [activeQuestionIds.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleSubmitClick = useCallback(() => {
    if (submittingRef.current) return;
    setConfirmOpen(true);
  }, []);

  const handleConfirmSubmit = useCallback(() => {
    setConfirmOpen(false);
    void doSubmit();
  }, [doSubmit]);

  if (authLoading || !allowed) return null;
  if (loading) return <Spinner label="Loading quiz..." />;

  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50">
        <AlertBanner variant="success">
          <p className="font-medium">You have already completed this quiz.</p>
          <p className="text-sm mt-1 opacity-80">Redirecting to your results...</p>
        </AlertBanner>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
        <div className="max-w-md w-full">
          <AlertBanner variant="error">
            <p className="font-medium mb-3">{initError}</p>
            <button
              type="button"
              onClick={() => navigate("/employee/home", { replace: true })}
              className="px-4 py-2 text-sm font-medium bg-white border border-red-300 text-red-800 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
            >
              Back to Home
            </button>
          </AlertBanner>
        </div>
      </div>
    );
  }

  if (!quiz || !attempt) return <Spinner />;

  const totalActive = activeQuestionIds.length;

  return (
    <EmployeeShell>
      <QuizTimerBar
        quizTitle={quiz.name}
        formatted={timer.formatted}
        progressPct={timer.progressPct}
        remainingSeconds={timer.remainingSeconds}
        onSubmit={handleSubmitClick}
        submitting={submitting}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {currentQuestion ? (
              <QuizQuestionCard
                questionIndex={currentIndex}
                totalQuestions={totalActive}
                questionText={currentQuestion.question}
                options={displayOptions}
                selectedKey={currentQId ? answers[currentQId] ?? null : null}
                onSelect={handleSelect}
                onPrev={handlePrev}
                onNext={handleNext}
                canGoPrev={currentIndex > 0}
                canGoNext={currentIndex < totalActive - 1}
              />
            ) : (
              <div className="bg-white border border-brand-100 rounded-lg p-8 text-center">
                <p className="text-slate-500">No question loaded</p>
              </div>
            )}

            <div className="bg-white border border-brand-100 rounded-lg p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {answeredSet.size}
                  </span>{" "}
                  of {totalActive} answered
                </div>
                <div className="text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {totalActive - answeredSet.size}
                  </span>{" "}
                  unanswered
                </div>
              </div>
              <div className="mt-3 h-2 bg-brand-50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                  style={{
                    width: `${totalActive > 0 ? (answeredSet.size / totalActive) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 lg:sticky lg:top-20 self-start space-y-4">
            <QuizNavButtons
              totalQuestions={totalActive}
              currentIndex={currentIndex}
              answered={answeredSet}
              questionOrder={activeQuestionIds}
              onGoTo={handleGoTo}
            />

            <button
              type="button"
              onClick={handleSubmitClick}
              disabled={submitting}
              className={cn(
                "w-full px-5 py-3 text-sm font-bold rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2",
                submitting
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-400 active:bg-emerald-800 shadow-sm"
              )}
            >
              {submitting ? "Submitting..." : "✓ Submit Quiz"}
            </button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-700/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900">Submit Quiz?</h3>
            <p className="mt-2 text-sm text-slate-600">
              You have answered <strong>{answeredSet.size}</strong> of{" "}
              <strong>{totalActive}</strong> questions.
              {answeredSet.size < totalActive && (
                <>
                  {" "}
                  <span className="text-amber-600 font-medium">
                    ({totalActive - answeredSet.size} unanswered)
                  </span>
                </>
              )}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Once submitted, you cannot change your answers.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 text-sm font-medium border border-slate-300 text-slate-700 bg-white rounded-md hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors"
              >
                {submitting ? "Submitting..." : "Confirm Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </EmployeeShell>
  );
}
