import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";

type PageProps = {
  params: Promise<{ clinicId: string }>;
};

export const metadata = {
  title: "Prontuários",
};

export default async function MedicalRecordsPage({ params }: PageProps) {
  const { clinicId } = await params;

  await requireClinicPermissions(clinicId, ["medical_records.read"]);

  return (
    <ModulePlaceholder
      title="Prontuários"
      description="Este módulo reunirá a linha do tempo clínica, correções e anexos privados dos pacientes."
    />
  );
}