/**
 * AAPC certificate template renderer.
 * Takes the pre-approved PDF template from Podio and overlays student name + date.
 * Only name and date are variable per Laureen's requirement — all other fields
 * (title, index number, expiration, AAPC approval stamp, QR code) are already
 * baked into the template.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { downloadFile } from "./podio";

export interface AapcCertificateProps {
  templateFileId: number;
  studentName: string;
  completionDate: Date;
}

// Template PDF cache — templates rarely change, cache for 1 hour per session
const templateCache = new Map<number, { bytes: Uint8Array; fetchedAt: number }>();
const TEMPLATE_CACHE_MS = 60 * 60 * 1000;

async function getTemplate(fileId: number): Promise<Uint8Array> {
  const cached = templateCache.get(fileId);
  if (cached && Date.now() - cached.fetchedAt < TEMPLATE_CACHE_MS) {
    return cached.bytes;
  }
  const bytes = await downloadFile(fileId);
  templateCache.set(fileId, { bytes, fetchedAt: Date.now() });
  return bytes;
}

export async function renderAapcCertificate(
  props: AapcCertificateProps
): Promise<Uint8Array> {
  const templateBytes = await getTemplate(props.templateFileId);

  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const { width } = page.getSize();

  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Name — centered horizontally, positioned above the "Name" line
  const name = props.studentName;
  const nameSize = 16;
  const nameWidth = helv.widthOfTextAtSize(name, nameSize);
  page.drawText(name, {
    x: (width - nameWidth) / 2,
    y: 345,
    size: nameSize,
    font: helv,
    color: rgb(0, 0, 0),
  });

  // Date — centered around x=380, above the "Date" line
  const dateStr = props.completionDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const dateSize = 12;
  const dateWidth = helv.widthOfTextAtSize(dateStr, dateSize);
  page.drawText(dateStr, {
    x: 380 - dateWidth / 2,
    y: 130,
    size: dateSize,
    font: helv,
    color: rgb(0, 0, 0),
  });

  return pdfDoc.save();
}
