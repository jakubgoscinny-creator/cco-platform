/**
 * CCO-T077: resolve a question's Podio-hosted image attachments (Supermenu
 * embeds), on demand as a question is actually viewed. Deliberately separate
 * from exam-start's bulk question sync — see resolveQuestionImages in
 * src/lib/sync.ts for why (avoids doubling Podio calls on the hot path).
 */
import { getSession } from "@/lib/auth";
import { resolveQuestionImages } from "@/lib/sync";
import { isPodioRateLimit } from "@/lib/podio";

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

  try {
    const images = await resolveQuestionImages(id);
    return Response.json({ images });
  } catch (err) {
    if (isPodioRateLimit(err)) {
      return new Response("Temporarily unavailable", {
        status: 503,
        headers: { "Retry-After": String(err.retryAfterSeconds) },
      });
    }
    throw err;
  }
}
