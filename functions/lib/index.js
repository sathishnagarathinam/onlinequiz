"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAdminRole = exports.evaluateSubmission = exports.submitQuiz = exports.helloWorld = void 0;
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const options_1 = require("firebase-functions/v2/options");
const firestore_2 = require("firebase-admin/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const db = admin.firestore();
(0, options_1.setGlobalOptions)({ region: "asia-south1" });
exports.helloWorld = (0, https_1.onCall)((request) => {
    return { message: "Hello from MCQ Portal" };
});
async function evaluateAttempt(attemptId) {
    const attemptRef = db.collection("attempts").doc(attemptId);
    const attemptSnap = await attemptRef.get();
    if (!attemptSnap.exists) {
        throw new https_1.HttpsError("not-found", "Attempt not found");
    }
    const attempt = attemptSnap.data();
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
    const priorCompletedCount = await db
        .collection("attempts")
        .where("employeeId", "==", employeeId)
        .where("quizId", "==", quizId)
        .where("status", "in", ["completed", "evaluated", "rejected"])
        .count()
        .get()
        .then((snap) => snap.data().count);
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
            await lockRef.set({
                employeeId,
                quizId,
                attemptId,
                uid,
                closed: true,
                closedAt: firestore_2.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        catch (lockErr) {
            logger.warn(`Lock close skipped (already written): ${lockErr}`);
        }
        if (!priorResultSnap.empty) {
            const prior = priorResultSnap.docs[0];
            return { resultId: prior.id, score: prior.data().score };
        }
        logger.warn(`Duplicate attempt detected (priorCompleted=${priorCompletedCount}) for employee ${employeeId} quiz ${quizId} — rejecting without new result`);
        throw new https_1.HttpsError("already-exists", "An attempt has already been evaluated for this employee and quiz");
    }
    const quizSnap = await db.collection("quizzes").doc(quizId).get();
    if (!quizSnap.exists) {
        throw new https_1.HttpsError("not-found", "Quiz not found");
    }
    const quiz = quizSnap.data();
    const closeTime = quiz.closeTime instanceof admin.firestore.Timestamp
        ? quiz.closeTime.toDate()
        : quiz.closeTime instanceof Date
            ? quiz.closeTime
            : new Date(quiz.closeTime);
    if (!attempt.submittedAt) {
        await attemptRef.update({
            status: "abandoned",
            rejectionReason: "not_submitted",
            evaluatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        throw new https_1.HttpsError("failed-precondition", "Attempt was not submitted");
    }
    const questionsSnap = await db
        .collection("quizzes")
        .doc(quizId)
        .collection("questions")
        .get();
    const questions = questionsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    }));
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const answers = attempt.answers ?? {};
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
        }
        else {
            wrongCount++;
            if (quiz.negativeMarking === true) {
                score -= (quiz.negativeMarkValue ?? 0) * marksEach;
            }
        }
    }
    const finalScore = Math.round(score * 100) / 100;
    const finalTotalMarks = totalMarks > 0 ? totalMarks : quiz.totalMarks ?? 0;
    const percentage = finalTotalMarks > 0
        ? Math.round((finalScore / finalTotalMarks) * 100)
        : 0;
    const startedAtDate = attempt.startedAt instanceof admin.firestore.Timestamp
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
    const timeTaken = Math.max(0, Math.round((submittedAtDate.getTime() - startedAtDate.getTime()) / 1000));
    const submittedLate = submittedAtDate.getTime() > closeTime.getTime();
    const resultRef = db.collection("results").doc();
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
        evaluatedAt: firestore_2.FieldValue.serverTimestamp(),
        createdAt: firestore_2.FieldValue.serverTimestamp(),
    });
    await attemptRef.update({
        status: "evaluated",
        evaluatedAt: firestore_2.FieldValue.serverTimestamp(),
    });
    try {
        await lockRef.set({
            employeeId,
            quizId,
            attemptId,
            uid,
            closed: true,
            closedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    catch (_) {
    }
    return { resultId: resultRef.id, score: finalScore };
}
exports.submitQuiz = (0, https_1.onCall)({ region: "asia-south1" }, async (request) => {
    const data = request.data;
    if (!data || !data.attemptId || typeof data.attemptId !== "string") {
        throw new https_1.HttpsError("invalid-argument", "attemptId is required");
    }
    try {
        const { resultId, score } = await evaluateAttempt(data.attemptId);
        return { ok: true, score, resultId };
    }
    catch (err) {
        if (err instanceof https_1.HttpsError) {
            throw err;
        }
        logger.error("submitQuiz error:", err);
        throw new https_1.HttpsError("internal", err?.message ?? "Failed to evaluate submission");
    }
});
exports.evaluateSubmission = (0, firestore_1.onDocumentWritten)({ region: "asia-south1", document: "attempts/{attemptId}" }, async (event) => {
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
    }
    catch (err) {
        logger.error(`Failed to evaluate attempt ${attemptId}:`, err);
    }
});
exports.setAdminRole = (0, https_1.onCall)({ region: "asia-south1" }, async (_request) => {
    return { ok: true, note: "no-auth mode: admin identity is client-side" };
});
//# sourceMappingURL=index.js.map