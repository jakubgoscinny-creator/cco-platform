import { type NextRequest, NextResponse } from "next/server";

// Public paths. `/api/sso/` must be public:
//   - /api/sso/token & /api/sso/userinfo are server-to-server calls from
//     Circle and will never carry a cco_session cookie
//   - /api/sso/authorize may be reached without a session; its route
//     handler does its own auth check and redirects to
//     /sign-in?return_to=... preserving Circle's OAuth state. If the
//     proxy redirected here first it would strip the return_to and
//     break the OAuth dance.
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
