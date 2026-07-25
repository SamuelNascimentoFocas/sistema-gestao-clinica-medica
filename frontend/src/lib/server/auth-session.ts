import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";

const EIGHT_HOURS_IN_SECONDS = 8 * 60 * 60;

function getBaseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function getSessionToken() {
  const cookieStore = await cookies();

  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: string | null,
) {
  const parsedExpiration = expiresAt ? new Date(expiresAt) : null;

  response.cookies.set(AUTH_COOKIE_NAME, token, {
    ...getBaseCookieOptions(),
    ...(parsedExpiration && !Number.isNaN(parsedExpiration.getTime())
      ? {
          expires: parsedExpiration,
        }
      : {
          maxAge: EIGHT_HOURS_IN_SECONDS,
        }),
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...getBaseCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
}