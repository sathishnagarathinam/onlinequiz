import { cn } from "../utils/ui";

/** Government of India Citizen's Value Pledge portal. */
export const PLEDGE_URL = "https://pledge.mygov.in/cvc/";

/**
 * Shown once the employee has finished the quiz, so they can take the
 * Citizen's Value Pledge on the mygov.in portal.
 */
export function PledgePrompt({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-white border border-brand-100 rounded-lg p-4 sm:p-5 text-left",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-gold-100 flex items-center justify-center shrink-0 mt-0.5">
          <svg
            className="h-4 w-4 text-gold-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75l2.25 2.25L15 9.75M12 3l7.5 3v5.25c0 4.5-3 8.25-7.5 9.75-4.5-1.5-7.5-5.25-7.5-9.75V6L12 3z"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900">
            Take the Citizen's Value Pledge
          </div>
          <div className="text-xs text-slate-500 mt-1">
            You have completed the quiz. Take the pledge on the mygov.in portal
            to record your commitment.
          </div>
          <a
            href={PLEDGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2"
          >
            Take the Pledge
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 6H6a1.5 1.5 0 00-1.5 1.5v10A1.5 1.5 0 006 19h10a1.5 1.5 0 001.5-1.5V10M15 4.5h4.5V9M19 5l-7 7"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
