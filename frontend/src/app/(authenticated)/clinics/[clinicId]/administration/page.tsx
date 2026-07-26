import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";

type PageProps = {
  params: Promise<{ clinicId: string }>;
};

export const metadata = {
  title: "Administração",
};

export default async function AdministrationPage({ params }: PageProps) {
  const { clinicId } = await params;

  await requireClinicPermissions(clinicId, [
    "clinics.update",
    "users.read",
    "users.create",
    "users.update",
    "users.assign_role",
    "professionals.create",
    "professionals.update",
  ]);

  return (
    <ModulePlaceholder
      title="Administração"
      description="Este módulo reunirá configurações, usuários, perfis, vínculos e operações administrativas."
    />
  );
}