import * as XLSX from "xlsx";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, "..", "templates");

mkdirSync(TEMPLATES_DIR, { recursive: true });

function generateQuestionsTemplate() {
  const headers = [
    "Question",
    "Option A",
    "Option B",
    "Option C",
    "Option D",
    "Correct Answer",
    "Marks",
    "Explanation",
  ];

  const sampleRows = [
    [
      "What is the capital of France?",
      "London",
      "Paris",
      "Berlin",
      "Madrid",
      "B",
      1,
      "Paris is the capital and most populous city of France.",
    ],
    [
      "Which planet is known as the Red Planet?",
      "Venus",
      "Mars",
      "Jupiter",
      "Saturn",
      "B",
      1,
      "Mars looks red because its surface is covered in iron oxide, or rust.",
    ],
    [
      "What is 2 + 2 multiplied by 3?",
      "12",
      "8",
      "10",
      "24",
      "B",
      2,
      "Multiplication is applied before addition, so 2 + (2 x 3) = 8.",
    ],
  ];

  const aoa = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const colWidths = [
    { wch: 40 },
    { wch: 25 },
    { wch: 25 },
    { wch: 25 },
    { wch: 25 },
    { wch: 15 },
    { wch: 8 },
    { wch: 55 },
  ];
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Questions");

  const outPath = resolve(TEMPLATES_DIR, "questions-template.xlsx");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  writeFileSync(outPath, buf);
  console.log(`✓ Generated: ${outPath}`);
}

function generateEmployeeTemplate() {
  const headers = [
    "Employee ID",
    "Name",
    "Office Name",
    "Division",
    "Designation",
  ];

  const sampleRows = [
    ["E001", "John Doe", "Head Office", "Administration", "Manager"],
    ["E002", "Jane Smith", "Branch A", "Engineering", "Senior Engineer"],
    ["E003", "Robert Johnson", "Branch B", "Sales", "Sales Executive"],
  ];

  const aoa = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const colWidths = [
    { wch: 15 },
    { wch: 25 },
    { wch: 20 },
    { wch: 20 },
    { wch: 25 },
  ];
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Employees");

  const outPath = resolve(TEMPLATES_DIR, "employee-master-template.xlsx");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  writeFileSync(outPath, buf);
  console.log(`✓ Generated: ${outPath}`);
}

try {
  console.log("Generating Excel templates...\n");
  generateQuestionsTemplate();
  generateEmployeeTemplate();
  console.log("\n✓ All templates generated successfully!");
} catch (err) {
  console.error("✗ Error generating templates:", err);
  process.exit(1);
}
