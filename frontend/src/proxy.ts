import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/accept-invitation") {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  const hasSessionCookie = request.cookies.has(AUTH_COOKIE_NAME);

  if (!hasSessionCookie) {
    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/login";
    loginUrl.search = "";

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/accept-invitation", "/dashboard/:path*", "/clinics/:path*"],
};
