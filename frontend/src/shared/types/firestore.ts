export type UserRole = "admin" | "employee";

export interface FirestoreUser {
  uid: string;
  role: UserRole;
  email?: string;
  displayName?: string;
  employeeId?: string;
  name?: string;
  officeName?: string;
  division?: string;
  designation?: string;
  createdAt: unknown;
  updatedAt?: unknown;
}

export interface Quiz {
  id?: string;
  name: string;
  description?: string;
  durationMinutes: number;
  totalMarks: number;
  negativeMarking: boolean;
  negativeMarkValue: number;
  numQuestionsToShow: number;
  targetOffice?: string;
  targetDivision?: string;
  openTime: unknown;
  closeTime: unknown;
  forceClosed?: boolean;
  resultsPublished?: boolean;
  rankListPublished?: boolean;
  /** Auto-publish times: results/rank become visible to employees once reached. */
  resultsPublishAt?: unknown;
  rankPublishAt?: unknown;
  createdBy: string;
  createdAt: unknown;
  updatedAt?: unknown;
}

export interface Question {
  id?: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: "A" | "B" | "C" | "D";
  marks: number;
  explanation?: string;
  quizId?: string;
  createdAt?: unknown;
}

export type AttemptStatus =
  | "in_progress"
  | "completed"
  /** Set by the evaluateAttempt Cloud Function once the attempt is scored. */
  | "evaluated"
  | "rejected"
  | "abandoned";

export interface Attempt {
  id?: string;
  uid: string;
  employeeId: string;
  quizId: string;
  /** Fixed at attempt start: drives the question and option shuffling. */
  seed: number;
  /**
   * The exact questions this attempt shows, already shuffled and cut down to the
   * quiz's "questions to show". Scoring and the review read it so only the
   * questions the employee actually saw are counted.
   */
  questionIds?: string[];
  status: AttemptStatus;
  answers?: Record<string, "A" | "B" | "C" | "D" | null>;
  startedAt: unknown;
  submittedAt?: unknown;
  evaluatedAt?: unknown;
  rejectionReason?: string;
}

export interface Result {
  id?: string;
  attemptId: string;
  uid: string;
  employeeId: string;
  employeeName?: string;
  officeName?: string;
  division?: string;
  designation?: string;
  quizId: string;
  score: number;
  adjustedScore?: number;
  totalMarks: number;
  percentage: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeTaken: number;
  published: boolean;
  rank?: number;
  evaluatedAt?: unknown;
  createdAt?: unknown;
}

export interface AuditLog {
  id?: string;
  action:
    | "question.import"
    | "question.replace"
    | "quiz.create"
    | "quiz.edit"
    | "quiz.delete"
    | "quiz.forceClose"
    | "results.publish"
    | "results.unpublish"
    | "results.schedule"
    | "results.adjust"
    | "rank.publish"
    | "rank.unpublish"
    | "rank.schedule"
    | "employee.import"
    | "employee.edit"
    | "admin.login"
    | "settings.update";
  adminUid: string;
  adminEmail?: string;
  timestamp: unknown;
  payload?: Record<string, unknown>;
}

export interface OfficeMaster {
  id?: string;
  divisions: string[];
  offices: string[];
  designations: string[];
}

export interface EmployeeMasterRow {
  employeeId: string;
  name: string;
  officeName: string;
  division: string;
  designation: string;
}

export interface QuestionImportRow {
  Question: string;
  "Option A": string;
  "Option B": string;
  "Option C": string;
  "Option D": string;
  "Correct Answer": string;
  Marks: number;
  Explanation?: string;
  _rowIndex?: number;
  _errors?: string[];
  _valid?: boolean;
}

export interface AppSettings {
  id?: string;
  masterListMode: boolean;
  maintenance?: boolean;
}
