import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Result } from "../types/firestore";
import { downloadBlob } from "./ui";

interface RankedResult extends Result {
  rank: number;
}

function computeRankedResults(results: Result[]): RankedResult[] {
  return results.map((r, idx) => ({ ...r, rank: idx + 1 }));
}

export async function exportRankExcel(
  results: Result[],
  filename: string
): Promise<void> {
  const ranked = computeRankedResults(results);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Rankings");

  worksheet.columns = [
    { header: "Rank", key: "rank", width: 8 },
    { header: "Employee ID", key: "employeeId", width: 18 },
    { header: "Name", key: "employeeName", width: 24 },
    { header: "Office", key: "officeName", width: 20 },
    { header: "Division", key: "division", width: 20 },
    { header: "Designation", key: "designation", width: 20 },
    { header: "Score", key: "score", width: 10 },
    { header: "Total Marks", key: "totalMarks", width: 12 },
    { header: "Percentage", key: "percentage", width: 12 },
    { header: "Time Taken (sec)", key: "timeTaken", width: 16 },
  ];

  worksheet.getRow(1).font = { bold: true };

  ranked.forEach((r) => {
    worksheet.addRow({
      rank: r.rank,
      employeeId: r.employeeId,
      employeeName: r.employeeName ?? "",
      officeName: r.officeName ?? "",
      division: r.division ?? "",
      designation: r.designation ?? "",
      score: r.adjustedScore ?? r.score,
      totalMarks: r.totalMarks,
      percentage: Number(r.percentage.toFixed(2)),
      timeTaken: r.timeTaken,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);
}

export async function exportRankPdf(
  results: Result[],
  title: string,
  filename: string
): Promise<void> {
  const ranked = computeRankedResults(results);
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(title, 14, 22);

  const head: string[][] = [
    [
      "Rank",
      "Employee ID",
      "Name",
      "Office",
      "Division",
      "Designation",
      "Score",
      "Total",
      "%",
      "Time (s)",
    ],
  ];

  const body: (string | number)[][] = ranked.map((r) => [
    r.rank,
    r.employeeId,
    r.employeeName ?? "",
    r.officeName ?? "",
    r.division ?? "",
    r.designation ?? "",
    String(r.adjustedScore ?? r.score),
    r.totalMarks,
    r.percentage.toFixed(2),
    r.timeTaken,
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 30,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  const blob = doc.output("blob");
  downloadBlob(blob, filename);
}
