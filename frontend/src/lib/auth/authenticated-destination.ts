import type { AuthUser } from "@/types/auth";

type GlobalAdminIdentity = Pick<AuthUser, "isGlobalAdmin">;

export function authenticatedDestination(
  user: GlobalAdminIdentity,
): "/admin" | "/clinics" {
  return user.isGlobalAdmin ? "/admin" : "/clinics";
}

export function loginResponseDestination(
  value: unknown,
): "/admin" | "/clinics" | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("user" in value) ||
    typeof value.user !== "object" ||
    value.user === null ||
    !("isGlobalAdmin" in value.user) ||
    typeof value.user.isGlobalAdmin !== "boolean"
  ) {
    return null;
  }

  return authenticatedDestination({
    isGlobalAdmin: value.user.isGlobalAdmin,
  });
}
