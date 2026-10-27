import {
  httpsCallable,
  type HttpsCallableResult,
} from "firebase/functions";
import { functions, db } from "./firebase";
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import type { AuditLog } from "../types/firestore";

type AuditAction = AuditLog["action"];

export async function callSubmitQuiz(
  attemptId: string
): Promise<HttpsCallableResult<{ ok: boolean; message?: string }>> {
  const fn = httpsCallable<
    { attemptId: string },
    { ok: boolean; message?: string }
  >(functions, "submitQuiz");
  return fn({ attemptId });
}

export async function callHelloWorld(
  name = "World"
): Promise<HttpsCallableResult<{ message: string }>> {
  const fn = httpsCallable<{ name?: string }, { message: string }>(
    functions,
    "helloWorld"
  );
  return fn({ name });
}

export async function writeAuditLog(
  params: Omit<AuditLog, "id" | "timestamp">
): Promise<void> {
  try {
    const ref = doc(collection(db, "auditLogs"));
    await setDoc(ref, { ...params, timestamp: serverTimestamp() });
  } catch (e) {
    console.warn("[auditLog] write failed", e);
  }
}

export async function listAuditLogs(limitCount = 200): Promise<
  Array<{ id: string } & AuditLog>
> {
  const q = query(
    collection(db, "auditLogs"),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog & { id: string }));
}

export type { AuditAction };
