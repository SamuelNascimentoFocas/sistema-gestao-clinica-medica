import { notFound } from "next/navigation";
import { ClinicProfessionalsManager } from "@/components/professionals/clinic-professionals-manager";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";
import { getClinicProfessionals } from "@/lib/server/clinic-professionals";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { getClinicMembers } from "@/lib/server/clinic-members";
import type { ProfessionalUserOption } from "@/types/professional";

type PageProps = {
  params: Promise<{
    clinicId: string;
  }>;
};

export const metadata = {
  title: "Profissionais",
};

export default async function ProfessionalsPage({
  params,
}: PageProps) {
  const { clinicId } = await params;

  const context = await requireClinicPermissions(
    clinicId,
    ["professionals.read"],
  );

  const canCreate = hasAnyPermission(
    context.access.permissions,
    ["professionals.create"],
  );

  const canUpdate = hasAnyPermission(
    context.access.permissions,
    ["professionals.update"],
  );

  const initialProfessionals =
    await getClinicProfessionals(clinicId);

  if (!initialProfessionals) {
    notFound();
  }

  let doctorOptions: ProfessionalUserOption[] = [];

  if (canCreate) {
    const members = await getClinicMembers(clinicId);

    doctorOptions = (members ?? [])
      .filter(
        (membership) =>
          membership.isActive &&
          membership.role.isActive &&
          membership.role.code === "doctor" &&
          membership.user.isActive &&
          !membership.user.isGlobalAdmin,
      )
      .map((membership) => ({
        userId: membership.user.id,
        fullName: membership.user.fullName,
        email: membership.user.email,
      }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Profissionais
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Consulte os profissionais vinculados à clínica,
          suas especialidades e configurações de
          atendimento.
        </p>
      </div>

      <ClinicProfessionalsManager
        clinicId={clinicId}
        initialProfessionals={initialProfessionals}
        canCreate={canCreate}
        canUpdate={canUpdate}
        doctorOptions={doctorOptions}
      />
    </div>
  );
}