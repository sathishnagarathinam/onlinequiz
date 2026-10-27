import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from "react";
import {
  findUserByEmployeeId,
  getSettings,
  employeeMasterExists,
  getUser,
  saveUserProfile,
} from "../../../shared/services/firestoreApi";
import type { FirestoreUser } from "../../../shared/types/firestore";

const LS_EMP = "mcq.portal.employee";
const LS_ADMIN = "mcq.portal.admin";

/** Admin credentials (intranet portal gate — not Firebase Auth). */
const ADMIN_USER_ID = "12345678";
const ADMIN_PASSWORD = "87654321";

/** Employee credentials: 8-digit user ID + shared default password. */
export const EMPLOYEE_ID_PATTERN = /^\d{8}$/;
export const DEFAULT_EMPLOYEE_PASSWORD = "Dop@12345";

/** Divisions offered on the employee profile step (alphabetical). */
export const DIVISION_OPTIONS: string[] = [
  "Coimbatore",
  "Dharmapuri",
  "Erode",
  "Krishnagiri",
  "MMS",
  "Namakkal",
  "Nilgiris",
  "Pollachi",
  "RMS",
  "Salem East",
  "Salem West",
  "Tirupattur",
  "Tirupur",
  "Western Region",
];

export interface EmployeeLoginInput {
  employeeId: string;
  password: string;
  name: string;
  officeName: string;
  division: string;
  designation: string;
}

export interface EmployeeLoginResult {
  ok: boolean;
  error?: string;
}

export interface EmployeeVerifyResult {
  ok: boolean;
  error?: string;
  /** Saved profile from Firebase, or null for a first-time employee. */
  profile?: EmployeeIdentity | null;
}

export interface EmployeeIdentity {
  employeeId: string;
  name: string;
  officeName: string;
  division: string;
  designation: string;
}

interface AuthCtxValue {
  loading: boolean;
  fbUser: null;
  dbUser: FirestoreUser | null;
  role: "admin" | "employee" | null;
  loginError: string | null;
  verifyEmployeeCredentials: (
    employeeId: string,
    password: string
  ) => Promise<EmployeeVerifyResult>;
  saveEmployeeProfile: (profile: EmployeeIdentity) => Promise<EmployeeLoginResult>;
  adminLogin: (userId: string, password: string) => Promise<EmployeeLoginResult>;
  logout: () => Promise<void>;
  employeeIdentity: EmployeeIdentity | null;
  setEmployeeIdentity: (e: EmployeeIdentity | null) => void;
  adminIdentity: { uid: string; email: string; displayName: string } | null;
  setAdminIdentity: (
    a: { uid: string; email: string; displayName: string } | null
  ) => void;
}

const AuthCtx = createContext<AuthCtxValue | null>(null);

function uidForEmployee(employeeId: string): string {
  return `emp_${employeeId}`;
}

function readEmployee(): EmployeeIdentity | null {
  try {
    const raw = localStorage.getItem(LS_EMP);
    return raw ? (JSON.parse(raw) as EmployeeIdentity) : null;
  } catch {
    return null;
  }
}

function writeEmployee(e: EmployeeIdentity | null) {
  if (e) localStorage.setItem(LS_EMP, JSON.stringify(e));
  else localStorage.removeItem(LS_EMP);
}

function readAdmin(): { uid: string; email: string; displayName: string } | null {
  try {
    const raw = localStorage.getItem(LS_ADMIN);
    return raw ? (JSON.parse(raw) as { uid: string; email: string; displayName: string }) : null;
  } catch {
    return null;
  }
}

function writeAdmin(a: { uid: string; email: string; displayName: string } | null) {
  if (a) localStorage.setItem(LS_ADMIN, JSON.stringify(a));
  else localStorage.removeItem(LS_ADMIN);
}

export function AuthContextProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [dbUser, setDbUser] = useState<FirestoreUser | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [employeeIdentity, setEmployeeIdentityState] = useState<EmployeeIdentity | null>(() =>
    readEmployee()
  );
  const [adminIdentity, setAdminIdentityState] = useState<
    { uid: string; email: string; displayName: string } | null
  >(() => readAdmin());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (adminIdentity) {
          const u = await getUser(adminIdentity.uid);
          if (!cancelled) setDbUser(u);
        } else if (employeeIdentity) {
          const u = await getUser(uidForEmployee(employeeIdentity.employeeId));
          if (!cancelled) setDbUser(u);
        } else if (!cancelled) {
          setDbUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeIdentity?.employeeId, adminIdentity?.uid]);

  const setEmployeeIdentity = useCallback((e: EmployeeIdentity | null) => {
    writeEmployee(e);
    setEmployeeIdentityState(e);
  }, []);

  const setAdminIdentity = useCallback(
    (a: { uid: string; email: string; displayName: string } | null) => {
      writeAdmin(a);
      setAdminIdentityState(a);
    },
    []
  );

  const verifyEmployeeCredentials = useCallback(
    async (employeeId: string, password: string): Promise<EmployeeVerifyResult> => {
      setLoginError(null);
      const id = employeeId.trim();

      if (!EMPLOYEE_ID_PATTERN.test(id)) {
        const msg = "Employee ID must be exactly 8 digits";
        setLoginError(msg);
        return { ok: false, error: msg };
      }
      if (password !== DEFAULT_EMPLOYEE_PASSWORD) {
        const msg = "Invalid password";
        setLoginError(msg);
        return { ok: false, error: msg };
      }

      setLoading(true);
      let profile: EmployeeIdentity | null = null;
      try {
        // Best-effort Firestore lookup — a Firestore outage (e.g. rules not
        // deployed) must not block login; it just falls through to the
        // profile step.
        const uid = uidForEmployee(id);
        const existingByEmpId = await findUserByEmployeeId(id);
        if (existingByEmpId && existingByEmpId.uid !== uid) {
          const msg = "Duplicate Employee ID already registered";
          setLoginError(msg);
          return { ok: false, error: msg };
        }

        const settings = await getSettings();
        if (settings?.masterListMode) {
          const inMaster = await employeeMasterExists(id);
          if (!inMaster) {
            const msg = "Employee ID not in approved master list";
            setLoginError(msg);
            return { ok: false, error: msg };
          }
        }

        const doc = existingByEmpId ?? (await getUser(uid));
        if (doc?.name && doc.officeName && doc.division) {
          profile = {
            employeeId: id,
            name: doc.name,
            officeName: doc.officeName,
            division: doc.division,
            designation: doc.designation ?? "",
          };
        }
      } catch {
        // Firestore unavailable — treat as a first-time login.
      } finally {
        setLoading(false);
      }

      return { ok: true, profile };
    },
    []
  );

  const saveEmployeeProfile = useCallback(
    async (profile: EmployeeIdentity): Promise<EmployeeLoginResult> => {
      setLoginError(null);
      setLoading(true);

      const employeeId = profile.employeeId.trim();

      try {
        const uid = uidForEmployee(employeeId);
        await saveUserProfile(uid, {
          uid,
          role: "employee",
          employeeId,
          name: profile.name,
          displayName: profile.name,
          officeName: profile.officeName,
          division: profile.division,
          designation: profile.designation,
        });
      } catch (e) {
        const msg =
          e instanceof Error
            ? `Could not save profile to Firebase: ${e.message}`
            : "Could not save profile to Firebase";
        setLoginError(msg);
        return { ok: false, error: msg };
      } finally {
        setLoading(false);
      }

      setEmployeeIdentity({ ...profile, employeeId });
      return { ok: true };
    },
    [setEmployeeIdentity]
  );

  const adminLogin = useCallback(
    async (userId: string, password: string): Promise<EmployeeLoginResult> => {
      setLoginError(null);

      if (userId.trim() !== ADMIN_USER_ID || password !== ADMIN_PASSWORD) {
        const msg = "Invalid admin user ID or password";
        setLoginError(msg);
        return { ok: false, error: msg };
      }

      const uid = `admin_${ADMIN_USER_ID}`;
      setAdminIdentity({
        uid,
        email: "admin@local",
        displayName: "Administrator",
      });

      // Best-effort Firestore mirror of the admin user record.
      try {
        await saveUserProfile(uid, {
          uid,
          role: "admin",
          email: "admin@local",
          displayName: "Administrator",
          name: "Administrator",
        });
      } catch {
        // Firestore unavailable — continue with local identity only.
      }

      return { ok: true };
    },
    [setAdminIdentity]
  );

  const logout = useCallback(async () => {
    setLoginError(null);
    setEmployeeIdentity(null);
    setAdminIdentity(null);
  }, [setEmployeeIdentity, setAdminIdentity]);

  let role: "admin" | "employee" | null = null;
  if (adminIdentity) role = "admin";
  else if (employeeIdentity) role = "employee";

  const value: AuthCtxValue = {
    loading,
    fbUser: null,
    dbUser,
    role,
    loginError,
    verifyEmployeeCredentials,
    saveEmployeeProfile,
    adminLogin,
    logout,
    employeeIdentity,
    setEmployeeIdentity,
    adminIdentity,
    setAdminIdentity,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuthCtx(): AuthCtxValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) {
    throw new Error("useAuthCtx must be used within AuthContextProvider");
  }
  return ctx;
}
