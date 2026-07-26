import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ClinicAppShell } from "@/components/layout/clinic-app-shell";
import { getClinicContext } from "@/lib/server/clinic-access";

type ClinicLayoutProps = {
  children: ReactNode;
  params: Promise<{
    clinicId: string;
  }>;
};

export default async function ClinicLayout({
  children,
  params,
}: ClinicLayoutProps) {
  const { clinicId } = await params;
  const context = await getClinicContext(clinicId);

  if (!context) {
    notFound();
  }

  const accessLabel =
    context.access.scope === "global"
      ? "Administrador global"
      : context.access.role?.name ?? "Perfil não identificado";

  return (
    <ClinicAppShell
      clinicId={clinicId}
      clinicName={context.clinic.name}
      accessLabel={accessLabel}
      permissions={context.access.permissions}
    >
      {children}
    </ClinicAppShell>
  );
}