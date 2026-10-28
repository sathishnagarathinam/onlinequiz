import { useEffect, useState, type ReactNode } from "react";
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

  // Off-canvas navigation. Only relevant below the lg breakpoint, where the
  // sidebar would otherwise eat most of the screen.
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !allowed) {
      navigate("/admin/login", { replace: true });
    }
  }, [loading, allowed, navigate]);

  // Close the drawer after navigating.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

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
    <div className="min-h-screen lg:h-screen flex bg-brand-50">
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-brand-900/50 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-60 bg-brand-900 text-brand-50 py-6 px-3 flex flex-col gap-1 overflow-y-auto transition-transform duration-200 lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="postal-stripe absolute top-0 left-0 right-0 h-1" />
        <div className="px-3 pb-5 mb-2 border-b border-brand-700/60 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Admin Panel</h2>
            <p className="text-xs text-brand-200/80 mt-0.5">
              India Post · Quiz Management
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
            className="lg:hidden p-1 rounded text-brand-200 hover:bg-brand-800 hover:text-white transition-colors"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
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

      {/* min-w-0 stops the wide admin tables from stretching the flex row. */}
      <main className="lg:ml-60 flex-1 flex flex-col min-w-0 lg:overflow-auto">
        <header className="sticky top-0 z-20 bg-white border-b border-brand-100">
          <div className="postal-stripe h-1" />
          <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                aria-label="Open navigation"
                className="lg:hidden shrink-0 p-2 -ml-2 rounded-md text-slate-600 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300 transition-colors"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              <div className="min-w-0">
                <nav className="text-xs text-slate-500 mb-1 truncate">
                  <span>Admin</span>
                  <span className="mx-1.5">/</span>
                  <span className="text-slate-700">
                    {current?.label ?? "Dashboard"}
                  </span>
                </nav>
                <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                  {title ?? current?.label ?? "Dashboard"}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block">
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

        <div className="p-4 sm:p-6 flex-1 min-w-0">
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}
