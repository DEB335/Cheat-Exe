import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, readSessionToken } from "@/lib/session";

const OWNER_ONLY = ["/owner-history", "/resellers", "/devices", "/banned-vault"];

/**
 * Replaces the old client-side redirect (which any visitor could skip)
 * with a real gate: no valid signed cookie, no dashboard.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    if (user) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  if (!user) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user.role !== "OWNER" && OWNER_ONLY.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/messages/:path*",
    "/generator/:path*",
    "/manager/:path*",
    "/owner-history/:path*",
    "/reseller-history/:path*",
    "/resellers/:path*",
    "/profile/:path*",
    "/audit-logs/:path*",
    "/devices/:path*",
    "/banned-vault/:path*",
  ],
};
