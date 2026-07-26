import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";

type PageProps = {
  params: Promise<{ clinicId: string }>;
};

export const metadata = {
  title: "Agendamentos",
};

export default async function AppointmentsPage({ params }: PageProps) {
  const { clinicId } = await params;

  await requireClinicPermissions(clinicId, ["appointments.read"]);

  return (
    <ModulePlaceholder
      title="Agendamentos"
      description="Este módulo reunirá criação, consulta, atualização e controle dos estados dos agendamentos."
    />
  );
}