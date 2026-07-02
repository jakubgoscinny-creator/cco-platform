/**
 * CCO-T077: proxy a Podio-hosted file's raw bytes through the portal's own
 * Podio credentials. files.podio.com requires a Podio login (redirects to
 * podio.com/login for an unauthenticated request — confirmed live), so a
 * student's browser can never load a Podio-hosted <img src> directly; this
 * route is the fix. `type` is a client-supplied rendering hint (from the
 * imageFiles the question-images route already returned), not re-derived
 * from Podio, to avoid a second live API call per image render.
 *
 * Gated on having an authenticated portal session (same bar as the AAPC
 * certificate template proxy), not per-question ownership — any signed-in
 * student/staff account can fetch any Podio file id through this route if
 * they know it. Acceptable for now (mirrors the existing cert-template
 * proxy's trust model); would need tightening if this route's use ever
 * expands beyond exam-question images.
 */
import { getSession } from "@/lib/auth";
import { downloadFile, isPodioRateLimit } from "@/lib/podio";

export const runtime = "nodejs";

const IMAGE_MIMETYPE = /^image\/[\w.+-]+$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { fileId } = await params;
  const id = Number(fileId);
  if (!id) return new Response("Invalid id", { status: 400 });

  const typeParam = new URL(request.url).searchParams.get("type");
  const contentType =
    typeParam && IMAGE_MIMETYPE.test(typeParam) ? typeParam : "image/jpeg";

  try {
    const bytes = await downloadFile(id);
    const out = new Uint8Array(bytes.byteLength);
    out.set(bytes);
    return new Response(new Blob([out]), {
      headers: {
        "Content-Type": contentType,
        // Question images are stable once uploaded — cache aggressively.
        "Cache-Control": "private, max-age=86400, immutable",
      },
    });
  } catch (err) {
    if (isPodioRateLimit(err)) {
      return new Response("Temporarily unavailable", {
        status: 503,
        headers: { "Retry-After": String(err.retryAfterSeconds) },
      });
    }
    return new Response("Not found", { status: 404 });
  }
}
