import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";

type PageProps = {
  params: Promise<{ clinicId: string }>;
};

export const metadata = {
  title: "Agendas",
};

export default async function SchedulesPage({ params }: PageProps) {
  const { clinicId } = await params;

  await requireClinicPermissions(clinicId, ["schedules.read"]);

  return (
    <ModulePlaceholder
      title="Agendas"
      description="Este módulo reunirá disponibilidades semanais, bloqueios e horários dos profissionais."
    />
  );
}