import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";

type PageProps = {
  params: Promise<{ clinicId: string }>;
};

export const metadata = {
  title: "Profissionais",
};

export default async function ProfessionalsPage({ params }: PageProps) {
  const { clinicId } = await params;

  await requireClinicPermissions(clinicId, ["professionals.read"]);

  return (
    <ModulePlaceholder
      title="Profissionais"
      description="Este módulo reunirá profissionais, vínculos clínicos e informações de atendimento."
    />
  );
}