import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthState } from "../../../shared/hooks/useAuthState";
import { useAuthCtx } from "../context/AuthContext";
import { cn } from "../../../shared/utils/ui";

interface ProtectedRouteProps {
  requiredRole: "admin" | "employee";
  children: ReactNode;
}

export function ProtectedRoute({ requiredRole, children }: ProtectedRouteProps) {
  const { loading, role } = useAuthState();
  const { adminIdentity, employeeIdentity } = useAuthCtx();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div
          className={cn(
            "w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin"
          )}
        />
      </div>
    );
  }

  if (requiredRole === "admin") {
    if (adminIdentity) return <>{children}</>;
    return <Navigate to="/admin/login" replace />;
  }

  if (role !== requiredRole) {
    if (employeeIdentity) {
      return <Navigate to="/employee/home" replace />;
    }
    return <Navigate to="/employee/login" replace />;
  }

  return <>{children}</>;
}
