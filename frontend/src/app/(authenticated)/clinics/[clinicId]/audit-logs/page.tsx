import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";

type PageProps = {
  params: Promise<{ clinicId: string }>;
};

export const metadata = {
  title: "Auditoria",
};

export default async function AuditLogsPage({ params }: PageProps) {
  const { clinicId } = await params;

  await requireClinicPermissions(clinicId, ["audit_logs.read"]);

  return (
    <ModulePlaceholder
      title="Auditoria"
      description="Este módulo reunirá registros de acesso e rastreabilidade das operações clínicas."
    />
  );
}