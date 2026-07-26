import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";

type PageProps = {
  params: Promise<{ clinicId: string }>;
};

export const metadata = {
  title: "Pacientes",
};

export default async function PatientsPage({ params }: PageProps) {
  const { clinicId } = await params;

  await requireClinicPermissions(clinicId, ["patients.read"]);

  return (
    <ModulePlaceholder
      title="Pacientes"
      description="Este módulo reunirá cadastro, pesquisa, atualização e vínculo dos pacientes com a clínica."
    />
  );
}