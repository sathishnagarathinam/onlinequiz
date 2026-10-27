/** India Post mark: white envelope on the Department's red, with the gold sweep. */
export function IndiaPostEmblem({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="India Post"
    >
      <rect width="48" height="48" rx="12" fill="#e31e24" />
      <rect
        x="9"
        y="12"
        width="30"
        height="20"
        rx="2.5"
        stroke="#ffffff"
        strokeWidth="2.5"
      />
      <path
        d="M10 14l14 11 14-11"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 37c6.5 0 8.5-4 17-4s10.5 4 17 4"
        stroke="#fdb913"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
