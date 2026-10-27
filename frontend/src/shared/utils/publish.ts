import { Timestamp } from "firebase/firestore";
import type { Quiz, Result } from "../types/firestore";

/** True once a scheduled moment has been reached. */
function reached(at: unknown, nowMs: number): boolean {
  if (at instanceof Timestamp) return nowMs >= at.toDate().getTime();
  if (typeof at === "string") {
    const t = new Date(at).getTime();
    return !Number.isNaN(t) && nowMs >= t;
  }
  return false;
}

/**
 * Results are visible when the admin publishes them manually **or** when the
 * scheduled publish time set on the quiz has passed. The time check runs at
 * read time, so no background job is needed to flip anything on.
 */
export function isResultVisible(
  result: Result | null,
  quiz: Quiz | null,
  nowMs: number = Date.now()
): boolean {
  if (result?.published) return true;
  // The admin "Results Published" toggle is authoritative for the whole quiz.
  if (quiz?.resultsPublished) return true;
  return reached(quiz?.resultsPublishAt, nowMs);
}

/** Same rule for the rank list. */
export function isRankVisible(
  quiz: Quiz | null,
  nowMs: number = Date.now()
): boolean {
  if (!quiz) return false;
  if (quiz.rankListPublished) return true;
  return reached(quiz?.rankPublishAt, nowMs);
}
