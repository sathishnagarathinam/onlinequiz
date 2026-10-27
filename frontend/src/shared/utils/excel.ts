import * as XLSX from "xlsx";
import type { QuestionImportRow, EmployeeMasterRow } from "../types/firestore";

const QUESTION_HEADERS = [
  "Question",
  "Option A",
  "Option B",
  "Option C",
  "Option D",
  "Correct Answer",
  "Marks",
  "Explanation",
];

const EMPLOYEE_HEADERS = [
  "Employee ID",
  "Name",
  "Office Name",
  "Division",
  "Designation",
];

export function arrayBufferToWorkbook(buf: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buf, { type: "array" });
}

export function readFirstSheet<T>(wb: XLSX.WorkBook): T[] {
  const first = wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[first], { defval: "" }) as T[];
}

function isNonEmpty(v: unknown): boolean {
  return v !== null && v !== undefined && String(v).trim().length > 0;
}

export function validateQuestionRows(
  rows: QuestionImportRow[]
): QuestionImportRow[] {
  return rows.map((r, idx) => {
    const errors: string[] = [];
    const row = { ...r, _rowIndex: idx + 2, _errors: errors };
    if (!isNonEmpty(row.Question)) errors.push("Question is required");
    if (!isNonEmpty(row["Option A"])) errors.push("Option A missing");
    if (!isNonEmpty(row["Option B"])) errors.push("Option B missing");
    if (!isNonEmpty(row["Option C"])) errors.push("Option C missing");
    if (!isNonEmpty(row["Option D"])) errors.push("Option D missing");
    const ans = String(row["Correct Answer"] || "").trim().toUpperCase();
    if (!["A", "B", "C", "D"].includes(ans)) {
      errors.push("Correct Answer must be A, B, C, or D");
    }
    const marksNum = Number(row.Marks);
    if (!Number.isFinite(marksNum) || marksNum <= 0) {
      errors.push("Marks must be a positive number");
    }
    row._valid = errors.length === 0;
    return row;
  });
}

export function validateEmployeeRows(
  rows: (Record<string, unknown> & EmployeeMasterRow)[]
): (EmployeeMasterRow & { _rowIndex: number; _errors: string[]; _valid: boolean })[] {
  return rows.map((r, idx) => {
    const errors: string[] = [];
    const row = { ...r, _rowIndex: idx + 2, _errors: errors };
    const raw = row as unknown as Record<string, unknown>;
    if (!isNonEmpty(raw["Employee ID"])) errors.push("Employee ID required");
    if (!isNonEmpty(raw["Name"])) errors.push("Name required");
    if (!isNonEmpty(raw["Office Name"])) errors.push("Office Name required");
    if (!isNonEmpty(raw["Division"])) errors.push("Division required");
    if (!isNonEmpty(raw["Designation"])) errors.push("Designation required");
    (row as unknown as { _valid: boolean })._valid = errors.length === 0;
    return row as (EmployeeMasterRow & { _rowIndex: number; _errors: string[]; _valid: boolean });
  });
}

export function questionRowErrorsCount(rows: QuestionImportRow[]): number {
  return rows.filter((r) => !r._valid).length;
}

export const TEMPLATE_CONSTANTS = {
  QUESTION_HEADERS,
  EMPLOYEE_HEADERS,
};
