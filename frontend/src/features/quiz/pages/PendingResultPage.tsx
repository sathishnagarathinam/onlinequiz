import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useRequireRole } from "../../../shared/hooks/useAuthState";
import {
  evaluateAttemptClient,
  findCompletedAttempt,
  getResultByAttempt,
} from "../../../shared/services/firestoreApi";
import { EmployeeShell } from "../../auth/components/EmployeeShell";

export function PendingResultPage() {
  const { quizId = "" } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { allowed, loading: authLoading, dbUser } = useRequireRole("employee");

  // Self-heal: if the attempt was submitted but never scored (e.g. the Cloud
  // Function was unavailable), score it now and jump to the result.
  useEffect(() => {
    if (authLoading || !allowed || !dbUser?.employeeId || !quizId) return;
    let cancelled = false;

    const heal = async () => {
      try {
        const attempt = await findCompletedAttempt(dbUser.employeeId!, quizId);
        if (!attempt?.id) return;

        let result = await getResultByAttempt(attempt.id);
        if (!result) {
          await evaluateAttemptClient(attempt.id).catch(() => null);
          result = await getResultByAttempt(attempt.id);
        }
        if (!cancelled && result?.id) {
          navigate(`/employee/results/${result.id}`, { replace: true });
        }
      } catch (e) {
        console.warn("[pending-result] self-heal failed", e);
      }
    };

    void heal();

    return () => {
      cancelled = true;
    };
  }, [authLoading, allowed, dbUser?.employeeId, quizId, navigate]);

  if (authLoading || !allowed) return null;

  return (
    <EmployeeShell>
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg
            className="h-10 w-10 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Quiz Submitted!
        </h1>
        <p className="text-sm text-slate-600 mb-8">
          Your quiz has been submitted successfully. Results are pending
          publication by the administrator.
        </p>

        <div className="bg-white border border-brand-100 rounded-lg p-5 mb-6 text-left">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg
                className="h-4 w-4 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900">
                Waiting for results
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Your answers are being evaluated. Come back later or check your
                home page for published results.
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/employee/home"
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 transition-colors"
          >
            Go to Home
          </Link>
          {quizId && (
            <Link
              to={`/employee/ranks/${quizId}`}
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold border border-slate-300 text-slate-700 bg-white rounded-md hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 transition-colors"
            >
              Check Rank List
            </Link>
          )}
        </div>
      </div>
      </div>
    </EmployeeShell>
  );
}
