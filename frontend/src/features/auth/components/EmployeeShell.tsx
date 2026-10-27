import type { ReactNode } from "react";
import { IndiaPostEmblem } from "../../../shared/components/IndiaPostEmblem";

/** Shared employee-portal backdrop, rendered at low opacity. */
export const EMPLOYEE_BACKGROUND = "/images/cbero1.webp";

interface EmployeeShellProps {
  children: ReactNode;
  /** Right-aligned header controls (logout button, back link, ...). */
  actions?: ReactNode;
  /** Optional page heading shown under the Department identity. */
  title?: string;
  subtitle?: string;
  background?: string;
}

export function EmployeeShell({
  children,
  actions,
  title,
  subtitle,
  background = EMPLOYEE_BACKGROUND,
}: EmployeeShellProps) {
  return (
    <div className="relative min-h-screen flex flex-col bg-slate-100">
      <img
        src={background}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
      />
      <div className="relative z-10 flex-1 flex flex-col">
        <header className="bg-white/95 border-b border-brand-100">
          <div className="postal-stripe h-1.5" />
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <IndiaPostEmblem className="h-10 w-10 rounded-lg shrink-0" />
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-slate-900 leading-tight truncate">
                  Department of Posts
                </h1>
                <p className="text-xs font-medium text-brand-600 leading-tight truncate">
                  Western Region, Coimbatore
                </p>
              </div>
            </div>
            {actions}
          </div>
          {(title || subtitle) && (
            <div className="max-w-5xl mx-auto px-6 pb-3">
              {title && (
                <h2 className="text-base font-semibold text-slate-900">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
              )}
            </div>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}
