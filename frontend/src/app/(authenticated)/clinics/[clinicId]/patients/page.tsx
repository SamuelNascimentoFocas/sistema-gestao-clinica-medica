import { notFound } from "next/navigation";
import { ClinicPatientsManager } from "@/components/patients/clinic-patients-manager";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";
import { getClinicPatients } from "@/lib/server/clinic-patients";
import { hasAnyPermission } from "@/lib/auth/permissions";

type PageProps = {
  params: Promise<{
    clinicId: string;
  }>;
};

export const metadata = {
  title: "Pacientes",
};

export default async function PatientsPage({
  params,
}: PageProps) {
  const { clinicId } = await params;

  const context = await requireClinicPermissions(
    clinicId,
    ["patients.read"],
  );

  const canCreate = hasAnyPermission(
    context.access.permissions,
    ["patients.create"],
  );

  const canUpdate = hasAnyPermission(
    context.access.permissions,
    ["patients.update"],
  );

  const initialPatients =
    await getClinicPatients(clinicId);

  if (!initialPatients) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Pacientes
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Consulte os pacientes vinculados à clínica e
          localize registros por diferentes informações.
        </p>
      </div>

      <ClinicPatientsManager
        clinicId={clinicId}
        initialPatients={initialPatients}
        canCreate={canCreate}
        canUpdate={canUpdate}
      />
    </div>
  );
}