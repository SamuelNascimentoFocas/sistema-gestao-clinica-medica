import { ClinicAdministrationManager } from "@/components/administration/clinic-administration-manager";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";

type PageProps = {
  params: Promise<{
    clinicId: string;
  }>;
};

export const metadata = {
  title: "Administração",
};

export default async function AdministrationPage({
  params,
}: PageProps) {
  const { clinicId } = await params;

  const context = await requireClinicPermissions(
    clinicId,
    ["users.read", "roles.manage"],
  );

  const permissions = context.access.permissions;

  const canCreate =
    hasAnyPermission(permissions, ["users.create"]) &&
    hasAnyPermission(permissions, ["users.assign_role"]);

  return (
    <ClinicAdministrationManager
      clinicId={clinicId}
      currentMembershipId={
        context.access.membershipId
      }
      canReadMembers={hasAnyPermission(permissions, ["users.read"])}
      canCreateMembers={canCreate}
      canAssignRole={hasAnyPermission(
        permissions,
        ["users.assign_role"],
      )}
      canChangeMemberStatus={hasAnyPermission(
        permissions,
        ["users.deactivate"],
      )}
      canManageRoles={hasAnyPermission(permissions, ["roles.manage"])}
    />
  );
}
