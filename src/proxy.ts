import { type NextRequest, NextResponse } from "next/server";

// Public paths. `/api/sso/` must be public:
//   - /api/sso/circle is the inbound Circle SSO entry point. Users arrive
//     here without a cco_session yet — the route handler creates one
//     after verifying the Circle JWT.
//   - /api/sso/circle-link is an operator-facing JSON spec endpoint used
//     by Laureen when configuring the cco.academy-side signer.
const PUBLIC_PATHS = ["/sign-in", "/api/health", "/api/sso/"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get("cco_session");
  if (!session?.value) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
