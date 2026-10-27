import { useEffect, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useRequireRole } from "../../../shared/hooks/useAuthState";
import { useAuthCtx } from "../../auth/context/AuthContext";
import { cn } from "../../../shared/utils/ui";

const navItems: Array<{ label: string; to: string }> = [
  { label: "Dashboard", to: "/admin/dashboard" },
  { label: "Quizzes", to: "/admin/quizzes" },
  { label: "Employee Master", to: "/admin/employees" },
  { label: "Results", to: "/admin/results" },
  { label: "Leaderboard", to: "/admin/leaderboard" },
  { label: "Audit Log", to: "/admin/audit" },
];

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-200 border-t-brand-600" />
    </div>
  );
}

interface AdminLayoutProps {
  children?: ReactNode;
  title?: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const { dbUser, loading, allowed } = useRequireRole("admin");
  const { adminIdentity, logout } = useAuthCtx();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !allowed) {
      navigate("/admin/login", { replace: true });
    }
  }, [loading, allowed, navigate]);

  if (loading) {
    return <Spinner />;
  }

  if (!allowed) {
    return null;
  }

  const current =
    navItems.find((n) =>
      n.to === "/admin/dashboard"
        ? location.pathname === n.to
        : location.pathname.startsWith(n.to)
    ) ?? navItems[0];

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="h-screen flex bg-brand-50">
      <aside className="fixed left-0 top-0 h-screen w-60 bg-brand-900 text-brand-50 py-6 px-3 flex flex-col gap-1 overflow-y-auto">
        <div className="postal-stripe absolute top-0 left-0 right-0 h-1" />
        <div className="px-3 pb-5 mb-2 border-b border-brand-700/60">
          <h2 className="text-lg font-semibold">Admin Panel</h2>
          <p className="text-xs text-brand-200/80 mt-0.5">
            India Post · Quiz Management
          </p>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin/dashboard"}
              className={({ isActive }) =>
                cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-600 text-white"
                    : "text-brand-100 hover:bg-brand-800 hover:text-white"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="mt-auto px-3 py-2 rounded-md text-sm font-medium text-brand-100 hover:bg-brand-800 hover:text-white transition-colors text-left"
        >
          Logout
        </button>
      </aside>

      <main className="ml-60 flex-1 flex flex-col overflow-auto">
        <header className="sticky top-0 z-10 bg-white border-b border-brand-100">
          <div className="postal-stripe h-1" />
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <nav className="text-xs text-slate-500 mb-1">
                <span>Admin</span>
                <span className="mx-1.5">/</span>
                <span className="text-slate-700">{current?.label ?? "Dashboard"}</span>
              </nav>
              <h1 className="text-lg font-semibold text-slate-900">
                {title ?? current?.label ?? "Dashboard"}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">
                  {adminIdentity?.displayName ??
                    dbUser?.displayName ??
                    dbUser?.name ??
                    "Admin User"}
                </p>
                <p className="text-xs text-slate-500">
                  {adminIdentity?.email ?? dbUser?.email ?? ""}
                </p>
              </div>
              <div className="h-9 w-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-semibold">
                {(adminIdentity?.displayName ??
                  dbUser?.displayName ??
                  dbUser?.name ??
                  "A"
                )
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 flex-1">
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}
