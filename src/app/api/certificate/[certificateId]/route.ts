import { getSession } from "@/lib/auth";
import { getCertificateById } from "@/lib/certificate";
import { renderCertificatePdf } from "@/lib/certificate-pdf";
import { renderAapcCertificate } from "@/lib/certificate-aapc";
import { db } from "@/lib/db";
import { attempts } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ certificateId: string }> }
): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { certificateId } = await params;
  const id = Number(certificateId);
  if (!id) {
    return new Response("Invalid certificate ID", { status: 400 });
  }

  const cert = await getCertificateById(id);
  if (!cert) {
    return new Response("Certificate not found", { status: 404 });
  }

  if (cert.contactId !== session.contactId) {
    return new Response("Forbidden", { status: 403 });
  }

  let pdfBytes: Uint8Array;
  let filenameSuffix: string;

  if (cert.type === "aapc_ceu" && cert.templateFileId) {
    // AAPC CEU certificate — uses Podio PDF template with name + date overlay
    pdfBytes = await renderAapcCertificate({
      templateFileId: cert.templateFileId,
      studentName: cert.studentName,
      completionDate: new Date(cert.completionDate),
    });
    filenameSuffix = "AAPC-CEU";
  } else {
    // CCO Certificate — branded React-PDF design
    // Fetch the score from the attempt for display on the certificate
    const [attempt] = await db
      .select({ scorePercent: attempts.scorePercent })
      .from(attempts)
      .where(eq(attempts.id, cert.attemptId))
      .limit(1);
    const scorePercent = attempt?.scorePercent
      ? Math.round(Number(attempt.scorePercent))
      : null;

    const buf = await renderCertificatePdf({
      studentName: cert.studentName,
      eventTitle: cert.eventTitle,
      ceuIndexNumber: cert.ceuIndexNumber,
      ceuValue: cert.ceuValue,
      aapcCeuTypes: cert.aapcCeuTypes,
      completionDate: new Date(cert.completionDate),
      verificationCode: cert.verificationCode,
      scorePercent,
    });
    pdfBytes = new Uint8Array(buf);
    filenameSuffix = "CCO";
  }

  // Copy into a fresh Uint8Array backed by a standard ArrayBuffer for type compatibility
  const outBuf = new Uint8Array(pdfBytes.byteLength);
  outBuf.set(pdfBytes);
  return new Response(new Blob([outBuf]), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameSuffix}-Certificate-${cert.verificationCode}.pdf"`,
    },
  });
}
