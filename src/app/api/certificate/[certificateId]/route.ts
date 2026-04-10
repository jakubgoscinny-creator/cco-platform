import { getSession } from "@/lib/auth";
import { getCertificateById } from "@/lib/certificate";
import { renderCertificatePdf } from "@/lib/certificate-pdf";

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

  const pdf = await renderCertificatePdf({
    studentName: cert.studentName,
    eventTitle: cert.eventTitle,
    ceuIndexNumber: cert.ceuIndexNumber,
    ceuValue: cert.ceuValue,
    aapcCeuTypes: cert.aapcCeuTypes,
    completionDate: new Date(cert.completionDate),
    verificationCode: cert.verificationCode,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CEU-Certificate-${cert.verificationCode}.pdf"`,
    },
  });
}
