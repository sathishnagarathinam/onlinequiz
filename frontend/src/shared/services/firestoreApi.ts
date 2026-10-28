import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  WriteBatch,
  writeBatch,
  limit,
  QueryConstraint,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { pickQuestionIds } from "../utils/shuffle";
import type {
  Quiz,
  Question,
  Attempt,
  Result,
  OfficeMaster,
  AppSettings,
  FirestoreUser,
} from "../types/firestore";

const COL = {
  USERS: "users",
  QUIZZES: "quizzes",
  QUESTIONS: "questions",
  ATTEMPTS: "attempts",
  RESULTS: "results",
  OFFICE: "officeMaster",
  EMP_MASTER: "employeeMaster",
  AUDIT: "auditLogs",
  SETTINGS: "settings",
};

export const collections = COL;

function stripUndefined<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

function withTimestamps<T extends object>(obj: T, create: boolean): T {
  const now = serverTimestamp();
  if (create) {
    return { ...stripUndefined(obj), createdAt: now } as T;
  }
  return { ...stripUndefined(obj), updatedAt: now } as T;
}

// --- Users ---
export async function createUser(user: FirestoreUser): Promise<void> {
  await setDoc(doc(db, COL.USERS, user.uid), withTimestamps(user, true));
}

export async function getUser(uid: string): Promise<FirestoreUser | null> {
  const snap = await getDoc(doc(db, COL.USERS, uid));
  return snap.exists() ? (snap.data() as FirestoreUser) : null;
}

export async function findUserByEmployeeId(employeeId: string): Promise<FirestoreUser | null> {
  const q = query(
    collection(db, COL.USERS),
    where("employeeId", "==", employeeId),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : (snap.docs[0].data() as FirestoreUser);
}

export async function listUsers(): Promise<FirestoreUser[]> {
  const snap = await getDocs(collection(db, COL.USERS));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as FirestoreUser));
}

export async function updateUser(uid: string, patch: Partial<FirestoreUser>): Promise<void> {
  await updateDoc(doc(db, COL.USERS, uid), withTimestamps(patch, false));
}

/** Create or merge a user document without clobbering existing fields. */
export async function saveUserProfile(
  uid: string,
  patch: Partial<FirestoreUser>
): Promise<void> {
  await setDoc(doc(db, COL.USERS, uid), withTimestamps(patch, false), { merge: true });
}

// --- Quizzes ---
export async function createQuiz(quiz: Omit<Quiz, "createdAt" | "id">): Promise<string> {
  const ref = doc(collection(db, COL.QUIZZES));
  await setDoc(ref, withTimestamps(quiz, true));
  return ref.id;
}

export async function updateQuiz(
  quizId: string,
  patch: Partial<Quiz>
): Promise<void> {
  await updateDoc(doc(db, COL.QUIZZES, quizId), withTimestamps(patch, false));
}

export async function deleteQuiz(quizId: string): Promise<void> {
  await deleteDoc(doc(db, COL.QUIZZES, quizId));
}

export async function getQuiz(quizId: string): Promise<Quiz | null> {
  const snap = await getDoc(doc(db, COL.QUIZZES, quizId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Quiz;
}

export async function listQuizzes(constraints: QueryConstraint[] = []): Promise<Quiz[]> {
  const q = query(collection(db, COL.QUIZZES), orderBy("openTime", "desc"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Quiz));
}

interface ListQuizzesForEmployeeOptions {
  /** Reference time for the open/close window. Defaults to now. */
  now?: Date;
  /** Also return quizzes whose window has not opened yet. */
  includeUpcoming?: boolean;
  /** Also return quizzes whose window has already closed. */
  includeClosed?: boolean;
  /** Quizzes that always stay visible regardless of window or force-close. */
  alwaysIncludeQuizIds?: string[];
}

export async function listQuizzesForEmployee(
  officeName?: string,
  division?: string,
  opts: ListQuizzesForEmployeeOptions = {}
): Promise<Quiz[]> {
  const {
    now = new Date(),
    includeUpcoming = false,
    includeClosed = false,
    alwaysIncludeQuizIds = [],
  } = opts;
  const always = new Set(alwaysIncludeQuizIds);
  const all = await listQuizzes();
  const nowTs = Timestamp.fromDate(now);
  return all.filter((q) => {
    const open = q.openTime as Timestamp;
    const close = q.closeTime as Timestamp;
    if (!open || !close) return false;
    // Quizzes the employee already submitted always stay visible, even if the
    // window has closed or the targeting no longer matches.
    if (q.id && always.has(q.id)) return true;
    if (q.targetOffice && officeName && q.targetOffice !== officeName) return false;
    if (q.targetDivision && division && q.targetDivision !== division) return false;
    if (q.forceClosed) return false;
    if (nowTs > close) return includeClosed;
    if (!includeUpcoming && nowTs < open) return false;
    return true;
  });
}

// --- Questions (subcollection under quiz) ---
export async function setQuestions(
  quizId: string,
  questions: Question[],
  replaceAll = true
): Promise<{ inserted: number; deletedOld: number }> {
  const col = collection(db, COL.QUIZZES, quizId, COL.QUESTIONS);
  let deletedOld = 0;

  if (replaceAll) {
    const existing = await getDocs(col);
    const batch = writeBatch(db);
    existing.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deletedOld = existing.size;
  }

  const batch = writeBatch(db);
  questions.forEach((q) => {
    const ref = doc(col);
    batch.set(ref, withTimestamps({ ...q, quizId }, true));
  });
  if (questions.length) await batch.commit();

  return { inserted: questions.length, deletedOld };
}

export async function listQuestions(quizId: string): Promise<Question[]> {
  const snap = await getDocs(collection(db, COL.QUIZZES, quizId, COL.QUESTIONS));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Question));
}

export async function updateQuestion(
  quizId: string,
  questionId: string,
  patch: Partial<Question>
): Promise<void> {
  await updateDoc(doc(db, COL.QUIZZES, quizId, COL.QUESTIONS, questionId), stripUndefined(patch));
}

export async function deleteQuestion(quizId: string, questionId: string): Promise<void> {
  await deleteDoc(doc(db, COL.QUIZZES, quizId, COL.QUESTIONS, questionId));
}

// --- Attempts ---
export async function createAttempt(attempt: Omit<Attempt, "id" | "startedAt">): Promise<string> {
  const ref = doc(collection(db, COL.ATTEMPTS));
  await setDoc(
    ref,
    withTimestamps({ ...attempt, startedAt: serverTimestamp() }, true)
  );
  return ref.id;
}

export interface AttemptLockData {
  employeeId: string;
  quizId: string;
  attemptId: string;
  uid: string;
  closed?: boolean;
}

/** Thrown when an employee who already attended the quiz tries to start again. */
export class AlreadyAttemptedError extends Error {
  constructor(message = "You have already attempted this quiz.") {
    super(message);
    this.name = "AlreadyAttemptedError";
  }
}

export interface StartAttemptInput {
  uid: string;
  employeeId: string;
  quizId: string;
  /** Every question id in the quiz; the attempt picks its own subset from these. */
  allQuestionIds: string[];
  /** Quiz setting "questions to show" — how many are picked for this attempt. */
  numQuestionsToShow: number;
}

export interface StartedAttempt {
  attempt: Attempt;
  /** True when an unfinished attempt was resumed instead of a new one created. */
  resumed: boolean;
}

/**
 * The single attempt this employee is allowed for this quiz.
 *
 * Reading the lock and writing the new attempt happen in one transaction, so a
 * double click or a second tab cannot create two attempts: the losing
 * transaction sees the lock already pointing at an attempt and resumes it.
 * A submitted attempt — or a closed lock — refuses to start again.
 *
 * The question order and subset are frozen here, at the attempt document, so the
 * scorer and the review show exactly what the employee saw.
 */
export async function startAttempt(
  input: StartAttemptInput
): Promise<StartedAttempt> {
  const { uid, employeeId, quizId, allQuestionIds, numQuestionsToShow } = input;
  const lockRef = doc(db, "attemptLocks", `${employeeId}_${quizId}`);
  const newAttemptRef = doc(collection(db, COL.ATTEMPTS));

  return runTransaction(db, async (tx) => {
    const lockSnap = await tx.get(lockRef);
    const linkedId = lockSnap.exists()
      ? (lockSnap.data().attemptId as string | undefined)
      : undefined;

    if (linkedId) {
      const linkedSnap = await tx.get(doc(db, COL.ATTEMPTS, linkedId));
      if (linkedSnap.exists()) {
        const linked = { id: linkedId, ...linkedSnap.data() } as Attempt;

        if (isSubmittedAttempt(linked) || lockSnap.data()?.closed === true) {
          throw new AlreadyAttemptedError();
        }

        if (linked.status === "in_progress") {
          return {
            resumed: true,
            attempt: {
              ...linked,
              // Attempts started before the subset was stored fall back to
              // re-deriving the order from their seed.
              questionIds:
                linked.questionIds ??
                pickQuestionIds(allQuestionIds, linked.seed, numQuestionsToShow),
            },
          };
        }
      }
    }

    const seed = Math.floor(Math.random() * 1000000000);
    const questionIds = pickQuestionIds(allQuestionIds, seed, numQuestionsToShow);
    const attempt: Attempt = {
      uid,
      employeeId,
      quizId,
      seed,
      questionIds,
      status: "in_progress",
      startedAt: serverTimestamp(),
    };

    tx.set(newAttemptRef, withTimestamps({ ...attempt }, true));
    tx.set(
      lockRef,
      withTimestamps(
        {
          employeeId,
          quizId,
          attemptId: newAttemptRef.id,
          uid,
          closed: false,
        },
        true
      ),
      { merge: true }
    );

    return { resumed: false, attempt: { id: newAttemptRef.id, ...attempt } };
  });
}

export async function getAttempt(attemptId: string): Promise<Attempt | null> {
  const snap = await getDoc(doc(db, COL.ATTEMPTS, attemptId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Attempt;
}

export async function updateAttempt(
  attemptId: string,
  patch: Partial<Attempt>
): Promise<void> {
  await updateDoc(doc(db, COL.ATTEMPTS, attemptId), stripUndefined(patch));
}

/**
 * The evaluateAttempt Cloud Function rewrites the attempt status to "evaluated",
 * so a submitted attempt can be either "completed" or "evaluated".
 */
export function isSubmittedAttempt(attempt: Attempt): boolean {
  return attempt.status === "completed" || attempt.status === "evaluated";
}

export async function findCompletedAttempt(
  employeeId: string,
  quizId: string
): Promise<Attempt | null> {
  const q = query(
    collection(db, COL.ATTEMPTS),
    where("employeeId", "==", employeeId),
    where("quizId", "==", quizId)
  );
  const snap = await getDocs(q);
  // Filtered in code rather than with `where("status", ...)`, because the status
  // can be either "completed" or "evaluated" once scoring has run.
  const found = snap.docs.find((d) => isSubmittedAttempt(d.data() as Attempt));
  return found ? ({ id: found.id, ...found.data() } as Attempt) : null;
}

/** Every attempt made by one employee, used to keep submitted quizzes on the home screen. */
export async function listAttemptsForEmployee(uid: string): Promise<Attempt[]> {
  const q = query(collection(db, COL.ATTEMPTS), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attempt));
}

// --- Results ---
/**
 * Keep one result per attempt. The Cloud Function and the client-side evaluator
 * both guard on `attemptId`, but when they run at the same instant they can each
 * store the same attempt and put the same employee twice on the leaderboard.
 */
function dedupeByAttempt(results: Result[]): Result[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.attemptId ?? r.id ?? "";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function listResults(quizId: string): Promise<Result[]> {
  const q = query(
    collection(db, COL.RESULTS),
    where("quizId", "==", quizId),
    orderBy("score", "desc"),
    orderBy("timeTaken", "asc")
  );
  const snap = await getDocs(q);
  return dedupeByAttempt(
    snap.docs.map((d) => ({ id: d.id, ...d.data() } as Result))
  );
}

export async function listAllResults(): Promise<Result[]> {
  const q = query(collection(db, COL.RESULTS), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Result));
}

/** Published/unpublished results belonging to one employee. */
export async function listResultsForEmployee(uid: string): Promise<Result[]> {
  const q = query(collection(db, COL.RESULTS), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Result));
}

export async function getResultByAttempt(attemptId: string): Promise<Result | null> {
  const q = query(
    collection(db, COL.RESULTS),
    where("attemptId", "==", attemptId),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as Result);
}

export async function getResult(resultId: string): Promise<Result | null> {
  const snap = await getDoc(doc(db, COL.RESULTS, resultId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Result;
}

function toDate(value: unknown, fallback: Date): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

/**
 * Score a submitted attempt in the browser and store the result document.
 *
 * This mirrors the evaluateAttempt Cloud Function and is used as a fallback when
 * the function is unreachable (e.g. local dev without deployed/emulated
 * functions) or when it left an already-submitted attempt unevaluated. Without
 * it the employee would wait forever on a result that never arrives.
 *
 * Returns the existing or newly created result id, or null when there is
 * nothing to evaluate.
 */
export async function evaluateAttemptClient(attemptId: string): Promise<string | null> {
  const attempt = await getAttempt(attemptId);
  if (!attempt || !attempt.id || !attempt.answers) return null;
  if (!isSubmittedAttempt(attempt)) return null;

  const existing = await getResultByAttempt(attemptId);
  if (existing?.id) return existing.id;

  const quiz = await getQuiz(attempt.quizId);
  const questions = await listQuestions(attempt.quizId);
  if (questions.length === 0) return null;

  // Only the questions this attempt actually showed are scored. Older attempts
  // did not store the subset, so they fall back to the whole question bank.
  const byId = new Map(questions.map((q) => [q.id ?? "", q] as const));
  const scored = attempt.questionIds?.length
    ? attempt.questionIds
        .map((id) => byId.get(id))
        .filter((q): q is Question => q !== undefined)
    : questions;

  const answers: Record<string, string | null> = attempt.answers;
  const negativeMarking = quiz?.negativeMarking === true;
  const negativeMarkValue = quiz?.negativeMarkValue ?? 0;

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;
  let score = 0;
  let totalMarks = 0;

  for (const q of scored) {
    const submitted = answers[q.id ?? ""] ?? null;
    const marksEach = q.marks ?? 0;
    totalMarks += marksEach;

    if (submitted === null) {
      skippedCount++;
      continue;
    }
    if (submitted === q.correctAnswer) {
      score += marksEach;
      correctCount++;
    } else {
      wrongCount++;
      if (negativeMarking) score -= negativeMarkValue * marksEach;
    }
  }

  const finalScore = Math.round(score * 100) / 100;
  const finalTotalMarks = totalMarks > 0 ? totalMarks : quiz?.totalMarks ?? 0;
  const percentage =
    finalTotalMarks > 0 ? Math.round((finalScore / finalTotalMarks) * 100) : 0;

  const startedAtDate = toDate(attempt.startedAt, new Date());
  const submittedAtDate = toDate(attempt.submittedAt, new Date());
  const timeTaken = Math.max(
    0,
    Math.round((submittedAtDate.getTime() - startedAtDate.getTime()) / 1000)
  );

  const user = await getUser(attempt.uid);

  // Deterministic id: sharing the attempt id with the Cloud Function makes the
  // write idempotent, so a scoring race cannot create two results.
  const resultRef = doc(db, COL.RESULTS, attemptId);
  await setDoc(
    resultRef,
    stripUndefined({
      attemptId,
      uid: attempt.uid,
      employeeId: attempt.employeeId,
      employeeName: user?.name,
      officeName: user?.officeName,
      division: user?.division,
      designation: user?.designation,
      quizId: attempt.quizId,
      score: finalScore,
      totalMarks: finalTotalMarks,
      percentage,
      correctCount,
      wrongCount,
      skippedCount,
      timeTaken,
      published: false,
      evaluatedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
    })
  );

  await updateAttempt(attemptId, {
    status: "evaluated",
    evaluatedAt: Timestamp.now(),
  });

  return resultRef.id;
}

export async function updateResult(
  resultId: string,
  patch: Partial<Result>
): Promise<void> {
  await updateDoc(doc(db, COL.RESULTS, resultId), stripUndefined(patch));
}

export async function publishResultsForQuiz(quizId: string, publish: boolean): Promise<void> {
  const q = query(collection(db, COL.RESULTS), where("quizId", "==", quizId));
  const snap = await getDocs(q);
  const batch: WriteBatch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { published: publish, updatedAt: serverTimestamp() }));
  batch.update(doc(db, COL.QUIZZES, quizId), {
    resultsPublished: publish,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function publishRankForQuiz(quizId: string, publish: boolean): Promise<void> {
  await updateQuiz(quizId, { rankListPublished: publish });
}

// --- Office Master ---
export async function getOfficeMaster(): Promise<OfficeMaster | null> {
  const snap = await getDoc(doc(db, COL.OFFICE, "main"));
  return snap.exists() ? (snap.data() as OfficeMaster) : null;
}

export async function setOfficeMaster(m: OfficeMaster): Promise<void> {
  await setDoc(doc(db, COL.OFFICE, "main"), m);
}

// --- App Settings ---
export async function getSettings(): Promise<AppSettings | null> {
  const snap = await getDoc(doc(db, COL.SETTINGS, "app"));
  return snap.exists() ? (snap.data() as AppSettings) : null;
}

export async function setSettings(s: AppSettings): Promise<void> {
  await setDoc(doc(db, COL.SETTINGS, "app"), withTimestamps(s, true), { merge: true });
}

// --- Employee Master ---
export async function upsertEmployeeMasterRow(
  row: { employeeId: string } & Record<string, unknown>
): Promise<void> {
  await setDoc(doc(db, COL.EMP_MASTER, row.employeeId), row, { merge: true });
}

export async function employeeMasterExists(employeeId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, COL.EMP_MASTER, employeeId));
  return snap.exists();
}

export async function listEmployeeMaster(): Promise<Array<{ id: string } & Record<string, unknown>>> {
  const snap = await getDocs(collection(db, COL.EMP_MASTER));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function bulkUpsertEmployeeMasterRows(
  rows: Array<{ employeeId: string } & Record<string, unknown>>
): Promise<void> {
  const batch: WriteBatch = writeBatch(db);
  rows.forEach((row) => {
    batch.set(doc(db, COL.EMP_MASTER, row.employeeId), row, { merge: true });
  });
  if (rows.length) await batch.commit();
}
