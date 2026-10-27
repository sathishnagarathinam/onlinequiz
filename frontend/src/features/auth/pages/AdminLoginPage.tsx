import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useAuthCtx } from "../context/AuthContext";
import { cn } from "../../../shared/utils/ui";

const loginSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { adminIdentity, adminLogin, loginError, loading } = useAuthCtx();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { userId: "", password: "" },
  });

  useEffect(() => {
    if (!loading && adminIdentity) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [loading, adminIdentity, navigate]);

  const onSubmit = async (data: LoginFormData) => {
    const result = await adminLogin(data.userId, data.password);
    if (result.ok) {
      navigate("/admin/dashboard", { replace: true });
    }
  };

  const busy = loading || isSubmitting;

  return (
    <div className="min-h-screen flex flex-col bg-postal-desk bg-cover bg-center">
      <div className="postal-stripe h-1.5 shrink-0" />
      <div className="flex-1 postal-overlay-light flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-brand-100">
          <div className="px-6 py-6 border-b border-brand-100 text-center">
            <div className="w-12 h-12 rounded-xl bg-brand-600 text-white mx-auto flex items-center justify-center mb-3 shadow-sm">
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m0 0v2m0-2h2m-2 0H10m7.071-7.071l-1.414 1.414M5.636 5.636l1.414 1.414M9 12a3 3 0 116 0 3 3 0 01-6 0z"
                />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-slate-900">Admin Login</h1>
            <p className="mt-1 text-sm text-slate-500">
              India Post · Online Quiz Portal
            </p>
          </div>

        {loginError && (
          <div className="mx-6 mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {loginError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              User ID
            </label>
            <input
              type="text"
              {...register("userId")}
              disabled={busy}
              autoComplete="username"
              className={cn(
                "w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent",
                errors.userId ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
              )}
              placeholder="Enter user ID"
            />
            {errors.userId && (
              <p className="mt-1 text-xs text-red-600">{errors.userId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              {...register("password")}
              disabled={busy}
              autoComplete="current-password"
              className={cn(
                "w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent",
                errors.password
                  ? "border-red-300 bg-red-50"
                  : "border-slate-300 bg-white"
              )}
              placeholder="Enter password"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className={cn(
              "w-full px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
          </form>
        </div>
      </div>
    </div>
  );
}
