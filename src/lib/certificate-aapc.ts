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

/** Shrink font size until the text fits within maxWidth (down to minSize). */
function fitFontSize(
  font: import("pdf-lib").PDFFont,
  text: string,
  maxWidth: number,
  preferredSize: number,
  minSize: number
): number {
  let size = preferredSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 1;
  }
  return size;
}

export async function renderAapcCertificate(
  props: AapcCertificateProps
): Promise<Uint8Array> {
  const templateBytes = await getTemplate(props.templateFileId);

  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const { width } = page.getSize();

  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // NAME — bold, prominent. Auto-shrinks for long names.
  // Preferred 24pt, min 13pt. Name line is ~520pt wide.
  const name = props.studentName;
  const nameSize = fitFontSize(helvBold, name, 520, 24, 13);
  const nameWidth = helvBold.widthOfTextAtSize(name, nameSize);
  page.drawText(name, {
    x: (width - nameWidth) / 2,
    y: 355, // breathing room above the line
    size: nameSize,
    font: helvBold,
    color: rgb(0, 0, 0),
  });

  // DATE — bold, prominent. Centered around x=380 (under the Index block).
  const dateStr = props.completionDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const dateSize = 16;
  const dateWidth = helvBold.widthOfTextAtSize(dateStr, dateSize);
  page.drawText(dateStr, {
    x: 380 - dateWidth / 2,
    y: 140,
    size: dateSize,
    font: helvBold,
    color: rgb(0, 0, 0),
  });

  return pdfDoc.save();
}
