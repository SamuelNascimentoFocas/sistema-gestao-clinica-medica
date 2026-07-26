import { notFound } from "next/navigation";
import { ClinicMembersManager } from "@/components/administration/clinic-members-manager";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";
import { getClinicMembers } from "@/lib/server/clinic-members";

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
    ["users.read"],
  );

  const members = await getClinicMembers(clinicId);

  if (!members) {
    notFound();
  }

  const permissions = context.access.permissions;

  const canCreate =
    hasAnyPermission(permissions, ["users.create"]) &&
    hasAnyPermission(permissions, ["users.assign_role"]);

  return (
    <ClinicMembersManager
      clinicId={clinicId}
      initialMembers={members}
      currentMembershipId={
        context.access.membershipId
      }
      canCreate={canCreate}
      canAssignRole={hasAnyPermission(
        permissions,
        ["users.assign_role"],
      )}
      canChangeStatus={hasAnyPermission(
        permissions,
        ["users.deactivate"],
      )}
    />
  );
}