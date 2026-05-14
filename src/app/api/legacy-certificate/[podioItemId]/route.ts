import { getSession, getSessionContact } from "@/lib/auth";
import { db } from "@/lib/db";
import { legacyTestResults } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { renderAapcCertificate } from "@/lib/certificate-aapc";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ podioItemId: string }> }
): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { podioItemId } = await params;
  const id = Number(podioItemId);
  if (!id) return new Response("Invalid id", { status: 400 });

  const [row] = await db
    .select()
    .from(legacyTestResults)
    .where(eq(legacyTestResults.podioItemId, id))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });
  if (row.contactItemId !== session.contactId) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!row.aapcTemplateFileId) {
    return new Response("No certificate template available", { status: 404 });
  }

  const contact = await getSessionContact();
  const studentName = contact?.fullName?.trim() || contact?.email || "Student";

  const completionDate = row.dateTaken
    ? new Date(row.dateTaken)
    : (row.syncedAt ? new Date(row.syncedAt) : new Date());

  const pdfBytes = await renderAapcCertificate({
    templateFileId: row.aapcTemplateFileId,
    studentName,
    completionDate,
  });

  // Same shape as the new-portal certificate route — copy into a fresh
  // ArrayBuffer so the Response body has a standard backing buffer.
  const out = new Uint8Array(pdfBytes.byteLength);
  out.set(pdfBytes);

  const safeName = (row.testName || "CEU")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40);

  return new Response(new Blob([out]), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="AAPC-CEU-${safeName}-${row.appItemId ?? id}.pdf"`,
    },
  });
}
