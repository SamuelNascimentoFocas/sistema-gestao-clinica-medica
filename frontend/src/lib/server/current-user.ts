import type { AuthUser } from "@/types/auth";
import { cache } from "react";
import { getSessionToken } from "@/lib/server/auth-session";
import {
  backendApiFetch,
  readBackendResponse,
} from "@/lib/server/backend-api";
import { logServerError } from "@/lib/server/server-logging";

function parseAuthenticatedUser(body: unknown): AuthUser | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const candidate = body as {
    user?: unknown;
  };

  if (typeof candidate.user !== "object" || candidate.user === null) {
    return null;
  }

  const user = candidate.user as Partial<AuthUser>;

  if (
    typeof user.id !== "string" ||
    typeof user.fullName !== "string" ||
    typeof user.email !== "string" ||
    typeof user.isGlobalAdmin !== "boolean" ||
    typeof user.isActive !== "boolean"
  ) {
    return null;
  }

  return user as AuthUser;
}

export const getCurrentUser = cache(async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  try {
    const response = await backendApiFetch("/api/v1/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const body = await readBackendResponse(response);
    const user = parseAuthenticatedUser(body);

    if (!user?.isActive) {
      return null;
    }

    return user;
  } catch (error) {
    logServerError("auth.current_user_validation_failed", error);

    return null;
  }
});
