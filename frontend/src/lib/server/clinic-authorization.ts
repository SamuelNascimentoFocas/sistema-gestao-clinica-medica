import { notFound } from "next/navigation";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { getClinicContext } from "@/lib/server/clinic-access";

export async function requireClinicPermissions(
  clinicId: string,
  requiredPermissions: readonly string[],
) {
  const context = await getClinicContext(clinicId);

  if (
    !context ||
    !hasAnyPermission(context.access.permissions, requiredPermissions)
  ) {
    notFound();
  }

  return context;
}