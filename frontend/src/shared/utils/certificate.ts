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

/** Issuing authority printed on the certificate. */
export const CERTIFICATE_ISSUER =
  "Postmaster General, Western Region, Coimbatore";
/** Event the certificate is awarded for. */
const EVENT = "Vigilance Awareness Week 2026";

/**
 * The certificate is a landscape design whose artwork was measured against a
 * 1536 x 1024 reference. `certificate-blank.jpg` is that artwork with the
 * specimen values diffused away, so the real details can be printed on top of
 * the frames, ribbons and India Post emblem it already carries.
 */
const ART = { file: "images/certificate-blank.jpg", w: 1536, h: 1024 };
/** The page keeps the artwork's exact 3:2 ratio, so it fills edge to edge. */
const PAGE = { w: 297, h: 198 };
/** Millimetres per reference pixel. */
const S = PAGE.w / ART.w;
/** Horizontal centre of the certificate body, in reference pixels. */
const BODY_CX = 770;
/** Horizontal centre of the signature block, in reference pixels. */
const SIGN_CX = 1266;
/** Widest line the artwork's inner panel can hold, in millimetres. */
const BODY_MAX_W = 245;

/** India Post red used for the recipient's name and marks. */
const RED: [number, number, number] = [193, 6, 10];
/** Dark navy used for every other printed line. */
const NAVY: [number, number, number] = [9, 35, 95];

/** A line of text pinned to the artwork, in reference pixels. */
interface Slot {
  /** Horizontal centre, or left edge when `align` is "left". */
  x: number;
  /** Text baseline. */
  baseline: number;
  size: number;
  style: "normal" | "bold";
  color: [number, number, number];
  align?: "center" | "left";
  /** Shrink the type until the line fits this width, in millimetres. */
  maxW?: number;
}

/** Text positions measured from the reference artwork. */
const SLOTS = {
  name: { x: BODY_CX, baseline: 563, size: 28, style: "bold", color: RED } as Slot,
  empid: { x: BODY_CX, baseline: 598, size: 13.5, style: "bold", color: NAVY, maxW: BODY_MAX_W } as Slot,
  para1: { x: BODY_CX, baseline: 630, size: 12.4, style: "normal", color: NAVY, maxW: BODY_MAX_W } as Slot,
  para2: { x: BODY_CX, baseline: 660, size: 12.4, style: "normal", color: NAVY, maxW: BODY_MAX_W } as Slot,
  marks: { x: BODY_CX, baseline: 717, size: 21, style: "bold", color: RED, maxW: 190 } as Slot,
  quiz: { x: BODY_CX, baseline: 767, size: 13.5, style: "bold", color: NAVY, maxW: BODY_MAX_W } as Slot,
  posting: { x: BODY_CX, baseline: 799, size: 12.2, style: "normal", color: NAVY, maxW: BODY_MAX_W } as Slot,
  issuer: { x: SIGN_CX, baseline: 847.5, size: 10, style: "bold", color: NAVY, maxW: 130 } as Slot,
  dept: { x: SIGN_CX, baseline: 872.5, size: 10, style: "bold", color: NAVY, maxW: 130 } as Slot,
  date: {
    x: 69,
    baseline: 940,
    size: 12,
    style: "normal",
    color: [255, 255, 255],
    align: "left",
    maxW: 70,
  } as Slot,
};

function loadArtwork(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Could not load the certificate artwork."));
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

/** Prints one measured line, shrinking it if the artwork's panel is too narrow. */
function put(doc: jsPDF, slot: Slot, text: string): void {
  doc.setFont("helvetica", slot.style);
  let size = slot.size;
  doc.setFontSize(size);
  while (slot.maxW && size > 6 && doc.getTextWidth(text) > slot.maxW) {
    size -= 0.25;
    doc.setFontSize(size);
  }
  doc.setTextColor(slot.color[0], slot.color[1], slot.color[2]);
  doc.text(text, slot.x * S, slot.baseline * S, {
    align: slot.align ?? "center",
  });
}

/**
 * Builds the Vigilance Awareness Week certificate on the artwork's own layout
 * and downloads it as a PDF.
 */
export async function exportCertificatePdf(
  input: CertificateInput
): Promise<void> {
  const artwork = await loadArtwork(
    `${import.meta.env.BASE_URL}${ART.file}`
  );

  const doc = new jsPDF({
    unit: "mm",
    format: [PAGE.w, PAGE.h],
    orientation: "landscape",
  });

  doc.addImage(artwork, "JPEG", 0, 0, PAGE.w, PAGE.h);

  const pct = Number.isFinite(input.percentage)
    ? input.percentage.toFixed(1)
    : "0.0";

  put(doc, SLOTS.name, input.employeeName || "Employee");
  put(doc, SLOTS.empid, `Employee ID: ${input.employeeId}`);
  put(
    doc,
    SLOTS.para1,
    `has participated in the ${EVENT} quiz`
  );
  put(
    doc,
    SLOTS.para2,
    "conducted by the Department of Posts, Western Region, Coimbatore, and secured"
  );
  put(
    doc,
    SLOTS.marks,
    `${input.score} out of ${input.totalMarks} marks (${pct}%)`
  );
  put(doc, SLOTS.quiz, `Quiz: ${input.quizName}`);
  put(
    doc,
    SLOTS.posting,
    [input.designation, input.officeName, input.division]
      .filter((v): v is string => !!v && v.trim().length > 0)
      .join(" • ")
  );
  put(doc, SLOTS.issuer, CERTIFICATE_ISSUER);
  put(
    doc,
    SLOTS.dept,
    "Department of Posts, Government of India"
  );
  put(
    doc,
    SLOTS.date,
    `Date: ${formatIssuedOn(input.issuedOn ?? new Date())}`
  );

  downloadBlob(doc.output("blob"), `Certificate-${input.employeeId}.pdf`);
}
