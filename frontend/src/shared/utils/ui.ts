import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(ts: unknown): string {
  if (!ts) return "";
  try {
    const d =
      typeof ts === "object" && ts != null && "toDate" in ts
        ? (ts as { toDate: () => Date }).toDate()
        : new Date(ts as string | number);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

export function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec)) return "-";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${s}s`;
}

/** Firestore timestamp (or date-like) -> value for a <input type="datetime-local">. */
export function timestampToLocalInput(ts: unknown): string {
  if (!ts) return "";
  try {
    const d =
      typeof ts === "object" && ts != null && "toDate" in ts
        ? (ts as { toDate: () => Date }).toDate()
        : new Date(ts as string | number);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
