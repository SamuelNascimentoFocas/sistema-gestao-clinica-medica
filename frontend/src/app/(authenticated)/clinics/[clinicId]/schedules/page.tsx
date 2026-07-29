import { notFound, redirect } from "next/navigation";
import { ClinicSchedulesManager } from "@/components/schedules/clinic-schedules-manager";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";
import { getClinicProfessionals } from "@/lib/server/clinic-professionals";
import { getCurrentUser } from "@/lib/server/current-user";
import { getProfessionalSchedule } from "@/lib/server/professional-schedule";

type PageProps = {
  params: Promise<{
    clinicId: string;
  }>;
};

export const metadata = {
  title: "Agendas",
};

export default async function SchedulesPage({
  params,
}: PageProps) {
  const { clinicId } = await params;

  const context = await requireClinicPermissions(
    clinicId,
    ["schedules.read"],
  );

  const [currentUser, professionalsResponse] =
    await Promise.all([
      getCurrentUser(),
      getClinicProfessionals(clinicId, {
        page: 1,
        perPage: 100,
      }),
    ]);

  if (!currentUser) {
    redirect("/login");
  }

  if (!professionalsResponse) {
    notFound();
  }

  const canManageAll = hasAnyPermission(
    context.access.permissions,
    ["schedules.manage"],
  );

  const canManageOwn = hasAnyPermission(
    context.access.permissions,
    ["schedules.manage_own"],
  );

  const ownProfessional = canManageOwn
    ? professionalsResponse.data.find(
        (professionalLink) =>
          professionalLink.professional.userId ===
          currentUser.id,
      )
    : undefined;

  const initialProfessional =
    ownProfessional ??
    professionalsResponse.data.find(
      (professionalLink) =>
        professionalLink.isActive,
    ) ??
    professionalsResponse.data[0] ??
    null;

  const initialScheduleResponse =
    initialProfessional === null
      ? null
      : await getProfessionalSchedule(
          clinicId,
          initialProfessional.professional.id,
        );

  if (
    initialProfessional !== null &&
    !initialScheduleResponse
  ) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Agendas
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Consulte disponibilidades semanais e bloqueios dos
          profissionais vinculados à clínica.
        </p>
      </div>

      <ClinicSchedulesManager
        clinicId={clinicId}
        clinicTimezone={context.clinic.timezone}
        professionals={professionalsResponse.data}
        initialProfessionalId={
          initialProfessional?.professional.id ?? null
        }
        initialSchedule={
          initialScheduleResponse?.schedule ?? null
        }
        currentUserId={currentUser.id}
        canManageAll={canManageAll}
        canManageOwn={canManageOwn}
      />
    </div>
  );
}