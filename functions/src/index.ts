import * as admin from "firebase-admin";
admin.initializeApp();

import {
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

const db = admin.firestore();

setGlobalOptions({ region: "asia-south1" });

export const helloWorld = onCall((request) => {
  return { message: "Hello from MCQ Portal" };
});

async function evaluateAttempt(
  attemptId: string
): Promise<{ resultId: string; score: number }> {
  const attemptRef = db.collection("attempts").doc(attemptId);
  const attemptSnap = await attemptRef.get();

  if (!attemptSnap.exists) {
    throw new HttpsError("not-found", "Attempt not found");
  }

  const attempt = attemptSnap.data()!;
  const { employeeId, quizId, uid } = attempt;

  const existingResultSnap = await db
    .collection("results")
    .where("attemptId", "==", attemptId)
    .limit(1)
    .get();

  if (!existingResultSnap.empty) {
    const existing = existingResultSnap.docs[0];
    return { resultId: existing.id, score: existing.data().score };
  }

  // One attempt per employee per quiz. The attempt being scored is already
  // flagged "completed" by the client before this call, so it has to be excluded
  // — otherwise every first submission would look like a duplicate.
  const priorAttemptsSnap = await db
    .collection("attempts")
    .where("employeeId", "==", employeeId)
    .where("quizId", "==", quizId)
    .get();

  const priorCompletedCount = priorAttemptsSnap.docs.filter(
    (d) =>
      d.id !== attemptId &&
      ["completed", "evaluated", "rejected"].includes(d.data().status)
  ).length;

  const lockId = `${employeeId}_${quizId}`;
  const lockRef = db.collection("attemptLocks").doc(lockId);

  if (priorCompletedCount > 0) {
    const priorResultSnap = await db
      .collection("results")
      .where("employeeId", "==", employeeId)
      .where("quizId", "==", quizId)
      .limit(1)
      .get();

    try {
      await lockRef.set(
        {
          employeeId,
          quizId,
          attemptId,
          uid,
          closed: true,
          closedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (lockErr) {
      logger.warn(`Lock close skipped (already written): ${lockErr}`);
    }

    if (!priorResultSnap.empty) {
      const prior = priorResultSnap.docs[0];
      return { resultId: prior.id, score: prior.data().score };
    }

    logger.warn(
      `Duplicate attempt detected (priorCompleted=${priorCompletedCount}) for employee ${employeeId} quiz ${quizId} — rejecting without new result`
    );
    throw new HttpsError(
      "already-exists",
      "An attempt has already been evaluated for this employee and quiz"
    );
  }

  const quizSnap = await db.collection("quizzes").doc(quizId).get();

  if (!quizSnap.exists) {
    throw new HttpsError("not-found", "Quiz not found");
  }

  const quiz = quizSnap.data()!;

  const closeTime =
    quiz.closeTime instanceof admin.firestore.Timestamp
      ? quiz.closeTime.toDate()
      : quiz.closeTime instanceof Date
      ? quiz.closeTime
      : new Date(quiz.closeTime);

  // Scoring runs *after* submission, so the quiz may already have closed by the
  // time this is called (e.g. the auto-submit fires right at the close time).
  // The window is enforced when the attempt is started, so refuse only attempts
  // that were never submitted — otherwise a legitimately submitted attempt
  // would never get a result and the employee would wait forever.
  if (!attempt.submittedAt) {
    await attemptRef.update({
      status: "abandoned",
      rejectionReason: "not_submitted",
      evaluatedAt: FieldValue.serverTimestamp(),
    });
    throw new HttpsError("failed-precondition", "Attempt was not submitted");
  }

  const questionsSnap = await db
    .collection("quizzes")
    .doc(quizId)
    .collection("questions")
    .get();

  const allQuestions = questionsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as { correctAnswer?: string; marks?: number }),
  }));

  // Score only the questions this attempt actually showed. Attempts created
  // before the subset was stored fall back to the whole question bank.
  const questionById = new Map(allQuestions.map((q) => [q.id, q] as const));
  const shownIds: string[] = Array.isArray(attempt.questionIds)
    ? attempt.questionIds
    : [];

  const questions = shownIds.length
    ? shownIds
        .map((id) => questionById.get(id))
        .filter((q): q is (typeof allQuestions)[number] => q !== undefined)
    : allQuestions;

  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.exists ? userSnap.data()! : {};

  const answers: Record<string, string | null> = attempt.answers ?? {};

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;
  let score = 0;
  let totalMarks = 0;

  for (const q of questions) {
    const qid = q.id;
    const correctAns = q.correctAnswer;
    const submitted = answers[qid] ?? null;
    const marksEach = q.marks ?? 0;

    totalMarks += marksEach;

    if (submitted === null || submitted === undefined) {
      skippedCount++;
      continue;
    }

    if (submitted === correctAns) {
      score += marksEach;
      correctCount++;
    } else {
      wrongCount++;
      if (quiz.negativeMarking === true) {
        score -= (quiz.negativeMarkValue ?? 0) * marksEach;
      }
    }
  }

  const finalScore = Math.round(score * 100) / 100;
  const finalTotalMarks = totalMarks > 0 ? totalMarks : quiz.totalMarks ?? 0;
  const percentage =
    finalTotalMarks > 0
      ? Math.round((finalScore / finalTotalMarks) * 100)
      : 0;

  const startedAtDate =
    attempt.startedAt instanceof admin.firestore.Timestamp
      ? attempt.startedAt.toDate()
      : attempt.startedAt instanceof Date
      ? attempt.startedAt
      : new Date();

  const submittedAtDate = attempt.submittedAt
    ? attempt.submittedAt instanceof admin.firestore.Timestamp
      ? attempt.submittedAt.toDate()
      : attempt.submittedAt instanceof Date
      ? attempt.submittedAt
      : new Date()
    : new Date();

  const timeTaken = Math.max(
    0,
    Math.round((submittedAtDate.getTime() - startedAtDate.getTime()) / 1000)
  );

  // Flagged for the admin: the answers came in after the quiz window closed.
  const submittedLate = submittedAtDate.getTime() > closeTime.getTime();

  // Deterministic id: sharing the attempt id with the client-side evaluator makes
  // the write idempotent, so a scoring race cannot create two results.
  const resultRef = db.collection("results").doc(attemptId);
  await resultRef.create({
    attemptId,
    uid,
    employeeId,
    employeeName: userData.name,
    officeName: userData.officeName,
    division: userData.division,
    designation: userData.designation,
    quizId,
    score: finalScore,
    totalMarks: finalTotalMarks,
    percentage,
    correctCount,
    wrongCount,
    skippedCount,
    timeTaken,
    submittedLate,
    published: false,
    evaluatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  await attemptRef.update({
    status: "evaluated",
    evaluatedAt: FieldValue.serverTimestamp(),
  });

  try {
    await lockRef.set(
      {
        employeeId,
        quizId,
        attemptId,
        uid,
        closed: true,
        closedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (_) {
    /* ignore */
  }

  return { resultId: resultRef.id, score: finalScore };
}

export const submitQuiz = onCall(
  { region: "asia-south1" },
  async (request) => {
    // No auth guard — no-auth mode. Employee identity is carried inside attempt doc.

    const data = request.data as { attemptId: string };
    if (!data || !data.attemptId || typeof data.attemptId !== "string") {
      throw new HttpsError("invalid-argument", "attemptId is required");
    }

    try {
      const { resultId, score } = await evaluateAttempt(data.attemptId);
      return { ok: true, score, resultId };
    } catch (err: any) {
      if (err instanceof HttpsError) {
        throw err;
      }
      logger.error("submitQuiz error:", err);
      throw new HttpsError(
        "internal",
        err?.message ?? "Failed to evaluate submission"
      );
    }
  }
);

export const evaluateSubmission = onDocumentWritten(
  { region: "asia-south1", document: "attempts/{attemptId}" },
  async (event) => {
    const attemptId = event.params.attemptId;
    const after = event.data?.after;
    const before = event.data?.before;

    if (!after || !after.exists) {
      return;
    }

    const afterData = after.data() ?? {};
    const beforeData = before?.exists ? before.data() ?? {} : {};

    if (beforeData.status === afterData.status) {
      return;
    }

    if (afterData.status !== "completed") {
      return;
    }

    if (afterData.evaluatedAt) {
      return;
    }

    try {
      await evaluateAttempt(attemptId);
      logger.info(`Successfully evaluated attempt ${attemptId}`);
    } catch (err: any) {
      logger.error(`Failed to evaluate attempt ${attemptId}:`, err);
    }
  }
);

export const setAdminRole = onCall(
  { region: "asia-south1" },
  async (_request) => {
    // No-op in no-auth mode. Kept for backwards compatibility with docs.
    return { ok: true, note: "no-auth mode: admin identity is client-side" };
  }
);
