import jsPDF from "jspdf";
import { downloadBlob } from "./ui";

/** Everything printed on an employee's quiz certificate. */
export interface CertificateInput {
  employeeName: string;
  employeeId: string;
  quizName: string;
  score: number;
  totalMarks: number;
  percentage: number;
  officeName?: string;
  division?: string;
  designation?: string;
  issuedOn?: Date;
}

/** Issuing authority. Replaces the address block printed on the template. */
export const CERTIFICATE_ISSUER =
  "Postmaster General, Western Region, Coimbatore";
/** Event the certificate is awarded for. */
const EVENT = "Vigilance Awareness Week 2026";

/** Template artwork (`certificate photo.jpeg`): 800 x 477 px. */
const ART = { file: "images/certificate-template.jpg", w: 800, h: 477 };
/**
 * The template's red footer band, in template pixels. It carries the original
 * Dharmapuri address, which is painted over with the issuing authority.
 */
const ART_BAND = { x0: 16, y0: 416, x1: 784, y1: 477 };
const ART_RED: [number, number, number] = [190, 35, 39];
/** Banner placement on the A4 portrait page, in millimetres. */
const BANNER = { x: 15, y: 12, w: 180 };
const MM_PER_PX = BANNER.w / ART.w;

function loadTemplate(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Could not load the certificate template image."));
    img.src = src;
  });
}

function formatIssuedOn(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Builds an A4 certificate: the supplied artwork as the top banner, with the
 * employee's details printed below it, and downloads it as a PDF.
 */
export async function exportCertificatePdf(
  input: CertificateInput
): Promise<void> {
  const template = await loadTemplate(
    `${import.meta.env.BASE_URL}${ART.file}`
  );

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Banner: the artwork's own design (event title, dates, slogan, motif).
  const bannerH = BANNER.w * (ART.h / ART.w);
  doc.addImage(template, "JPEG", BANNER.x, BANNER.y, BANNER.w, bannerH);

  // Paint over the artwork's Dharmapuri address and sign the band off as PMG.
  const bandX = BANNER.x + ART_BAND.x0 * MM_PER_PX;
  const bandY = BANNER.y + ART_BAND.y0 * MM_PER_PX;
  const bandW = (ART_BAND.x1 - ART_BAND.x0) * MM_PER_PX;
  const bandH = (ART_BAND.y1 - ART_BAND.y0) * MM_PER_PX;
  doc.setFillColor(ART_RED[0], ART_RED[1], ART_RED[2]);
  doc.rect(bandX, bandY, bandW, bandH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(CERTIFICATE_ISSUER, pageW / 2, bandY + bandH / 2 + 1.1, {
    align: "center",
  });

  // Body: everything the artwork does not carry, laid out top to bottom.
  const maxWidth = pageW - 40;
  let y = BANNER.y + bannerH + 12;

  const put = (
    text: string,
    size: number,
    style: "normal" | "bold",
    color: [number, number, number],
    gap: number
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    const lineHeight = size * 0.42;
    lines.forEach((line, i) => {
      doc.text(line, pageW / 2, y + lineHeight * (i + 1), { align: "center" });
    });
    y += lineHeight * lines.length + gap;
  };

  put("This is to certify that", 13, "normal", [71, 85, 105], 9);
  put(input.employeeName || "Employee", 24, "bold", [15, 23, 42], 3);
  put(`Employee ID: ${input.employeeId}`, 11, "normal", [71, 85, 105], 9);
  put(
    `has participated in the ${EVENT} quiz conducted by the Department of Posts, Western Region, Coimbatore, and secured`,
    11.5,
    "normal",
    [51, 65, 85],
    6
  );
  const pct = Number.isFinite(input.percentage)
    ? input.percentage.toFixed(1)
    : "0.0";
  put(
    `${input.score} out of ${input.totalMarks} marks (${pct}%)`,
    18,
    "bold",
    ART_RED,
    10
  );
  put(`Quiz: ${input.quizName}`, 12, "bold", [15, 23, 42], 6);

  const posting = [input.designation, input.officeName, input.division]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join("  ·  ");
  if (posting) put(posting, 10.5, "normal", [100, 116, 139], 0);

  // Sign-off block.
  const footerY = pageH - 26;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(pageW - 88, footerY - 7, pageW - 20, footerY - 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${formatIssuedOn(input.issuedOn ?? new Date())}`, 20, footerY);

  doc.setFont("helvetica", "bold");
  doc.text(CERTIFICATE_ISSUER, pageW - 20, footerY, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Department of Posts, Government of India",
    pageW - 20,
    footerY + 5,
    { align: "right" }
  );

  doc.setFontSize(8);
  doc.text("This is a system generated certificate.", pageW / 2, pageH - 10, {
    align: "center",
  });

  downloadBlob(doc.output("blob"), `Certificate-${input.employeeId}.pdf`);
}
