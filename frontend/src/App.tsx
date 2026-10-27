import { Link, Navigate, Route, Routes, BrowserRouter } from "react-router-dom";
import { AuthContextProvider } from "./features/auth/context/AuthContext";
import { ProtectedRoute } from "./features/auth/components/ProtectedRoute";
import { useAuthState } from "./shared/hooks/useAuthState";
import { cn } from "./shared/utils/ui";

import { EmployeeLoginPage } from "./features/auth/pages/EmployeeLoginPage";
import { EmployeeHomePage } from "./features/auth/pages/EmployeeHomePage";
import AdminLoginPage from "./features/auth/pages/AdminLoginPage";

import DashboardPage from "./features/admin/pages/DashboardPage";
import QuizListPage from "./features/admin/pages/QuizListPage";
import QuizFormPage from "./features/admin/pages/QuizFormPage";
import QuestionBankPage from "./features/admin/pages/QuestionBankPage";
import QuestionUploadPage from "./features/admin/pages/QuestionUploadPage";
import EmployeeMasterPage from "./features/admin/pages/EmployeeMasterPage";
import ResultListPage from "./features/admin/pages/ResultListPage";
import ResultReviewPage from "./features/admin/pages/ResultReviewPage";
import LeaderboardPage from "./features/admin/pages/LeaderboardPage";
import AuditLogPage from "./features/admin/pages/AuditLogPage";

import { QuizAttemptPage } from "./features/quiz/pages/QuizAttemptPage";
import { EmployeeResultPage } from "./features/quiz/pages/EmployeeResultPage";
import { PendingResultPage } from "./features/quiz/pages/PendingResultPage";
import { EmployeeRankViewPage } from "./features/quiz/pages/EmployeeRankViewPage";
import { IndiaPostEmblem } from "./shared/components/IndiaPostEmblem";

function LandingPage() {
  const { role, loading } = useAuthState();

  if (!loading) {
    if (role === "employee") {
      return <Navigate to="/employee/home" replace />;
    }
    if (role === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-postal-hero bg-cover bg-center bg-fixed">
      <div className="postal-stripe h-1.5 shrink-0" />
      <div className="flex-1 postal-overlay-dark flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <div className="text-center mb-10">
            <IndiaPostEmblem className="h-20 w-20 mx-auto mb-5 rounded-2xl shadow-lg" />
            <p className="text-xs font-semibold tracking-[0.35em] text-gold-300">
              भारतीय डाक
            </p>
            <h1 className="mt-1.5 text-3xl font-bold text-white tracking-tight">
              INDIA POST
            </h1>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 ring-1 ring-white/20 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
              <span className="text-sm font-medium text-white">
                Online Quiz Portal
              </span>
            </div>
            <p className="mt-3 text-sm text-white/70">
              Select your portal to continue
            </p>
          </div>

          <div className="space-y-4">
            <Link
              to="/employee/login"
              className={cn(
                "group block w-full p-6 rounded-xl border-2 transition-all",
                "bg-white/95 backdrop-blur-sm border-white/40 hover:border-brand-500 hover:shadow-2xl hover:-translate-y-0.5"
              )}
            >
              <div className="flex items-center gap-5">
                <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors">
                  <svg
                    className="h-7 w-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-lg font-bold text-slate-900 group-hover:text-brand-700 transition-colors">
                    Employee Portal
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5">
                    Take quizzes, view your results and ranks
                  </div>
                </div>
                <svg
                  className="h-5 w-5 text-slate-300 group-hover:text-brand-500 group-hover:translate-x-1 transition-all"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>

            <Link
              to="/admin/login"
              className={cn(
                "group block w-full p-6 rounded-xl border-2 transition-all text-left",
                "bg-white/95 backdrop-blur-sm border-white/40 hover:border-slate-900 hover:shadow-2xl hover:-translate-y-0.5"
              )}
            >
              <div className="flex items-center gap-5">
                <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-slate-900 text-gold-400 flex items-center justify-center group-hover:bg-slate-800 group-hover:text-gold-300 transition-colors">
                  <svg
                    className="h-7 w-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-lg font-bold text-slate-900 group-hover:text-brand-700 transition-colors">
                    Admin Portal
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5">
                    Manage quizzes, employees, results and audit logs
                  </div>
                </div>
                <svg
                  className="h-5 w-5 text-slate-300 group-hover:text-slate-900 group-hover:translate-x-1 transition-all"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                />
              </svg>
              </div>
            </Link>
          </div>

          <p className="mt-8 text-center text-xs text-white/60">
            Department of Posts · Government of India
          </p>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      {/* Employee routes */}
      <Route path="/employee/login" element={<EmployeeLoginPage />} />
      <Route
        path="/employee/home"
        element={
          <ProtectedRoute requiredRole="employee">
            <EmployeeHomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee/quiz/:quizId"
        element={
          <ProtectedRoute requiredRole="employee">
            <QuizAttemptPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee/pending-results/:quizId"
        element={
          <ProtectedRoute requiredRole="employee">
            <PendingResultPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee/results/:resultId"
        element={
          <ProtectedRoute requiredRole="employee">
            <EmployeeResultPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee/ranks"
        element={
          <ProtectedRoute requiredRole="employee">
            <EmployeeRankViewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee/ranks/:quizId"
        element={
          <ProtectedRoute requiredRole="employee">
            <EmployeeRankViewPage />
          </ProtectedRoute>
        }
      />

      {/* Admin routes — credentials gate at /admin/login */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute requiredRole="admin">
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/quizzes"
        element={
          <ProtectedRoute requiredRole="admin">
            <QuizListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/quizzes/new"
        element={
          <ProtectedRoute requiredRole="admin">
            <QuizFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/quizzes/:quizId/edit"
        element={
          <ProtectedRoute requiredRole="admin">
            <QuizFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/quizzes/:quizId/questions"
        element={
          <ProtectedRoute requiredRole="admin">
            <QuestionBankPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/quizzes/:quizId/questions/upload"
        element={
          <ProtectedRoute requiredRole="admin">
            <QuestionUploadPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/employees"
        element={
          <ProtectedRoute requiredRole="admin">
            <EmployeeMasterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/results"
        element={
          <ProtectedRoute requiredRole="admin">
            <ResultListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/results/:quizId/review"
        element={
          <ProtectedRoute requiredRole="admin">
            <ResultReviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/leaderboard"
        element={
          <ProtectedRoute requiredRole="admin">
            <LeaderboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/leaderboard/:quizId"
        element={
          <ProtectedRoute requiredRole="admin">
            <LeaderboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <ProtectedRoute requiredRole="admin">
            <AuditLogPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// GitHub Pages project sites are served from /<repo-name>/, so the router must
// be told about that prefix or no route would ever match.
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export default function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <AuthContextProvider>
        <AppRoutes />
      </AuthContextProvider>
    </BrowserRouter>
  );
}
