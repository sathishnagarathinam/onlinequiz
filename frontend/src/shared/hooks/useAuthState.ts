import { useAuthCtx } from "../../features/auth/context/AuthContext";
import type { FirestoreUser } from "../types/firestore";

export interface AuthState {
  fbUser: null;
  dbUser: FirestoreUser | null;
  loading: boolean;
  role: "admin" | "employee" | null;
}

export function useAuthState(): AuthState {
  const { loading, dbUser, role } = useAuthCtx();
  return { fbUser: null, dbUser, loading, role };
}

export function useRequireRole(
  targetRole: "admin" | "employee"
): AuthState & { allowed: boolean } {
  const state = useAuthState();
  if (targetRole === "admin") {
    return { ...state, allowed: state.role === "admin" };
  }
  return { ...state, allowed: state.role === "employee" };
}
