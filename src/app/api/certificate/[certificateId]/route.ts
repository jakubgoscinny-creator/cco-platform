import { getSession } from "@/lib/auth";
import { getCertificateById } from "@/lib/certificate";
import { renderCertificatePdf } from "@/lib/certificate-pdf";
import { renderAapcCertificate } from "@/lib/certificate-aapc";

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

  // Only the certificate owner can download it
  if (cert.contactId !== session.contactId) {
    return new Response("Forbidden", { status: 403 });
  }

  let pdfBytes: Uint8Array;

  if (cert.templateFileId) {
    // Use the AAPC-approved template from Podio with name + date overlay
    pdfBytes = await renderAapcCertificate({
      templateFileId: cert.templateFileId,
      studentName: cert.studentName,
      completionDate: new Date(cert.completionDate),
    });
  } else {
    // Fallback: CCO-branded certificate (for CEUs without an AAPC template)
    const buf = await renderCertificatePdf({
      studentName: cert.studentName,
      eventTitle: cert.eventTitle,
      ceuIndexNumber: cert.ceuIndexNumber,
      ceuValue: cert.ceuValue,
      aapcCeuTypes: cert.aapcCeuTypes,
      completionDate: new Date(cert.completionDate),
      verificationCode: cert.verificationCode,
    });
    pdfBytes = new Uint8Array(buf);
  }

  // Copy into a fresh Uint8Array backed by a standard ArrayBuffer for type compatibility
  const outBuf = new Uint8Array(pdfBytes.byteLength);
  outBuf.set(pdfBytes);
  return new Response(new Blob([outBuf]), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CEU-Certificate-${cert.verificationCode}.pdf"`,
    },
  });
}
