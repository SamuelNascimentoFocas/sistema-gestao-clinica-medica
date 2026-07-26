import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClinicContext } from "@/lib/server/clinic-access";

type ClinicDashboardPageProps = {
  params: Promise<{
    clinicId: string;
  }>;
};

export default async function ClinicDashboardPage({
  params,
}: ClinicDashboardPageProps) {
  const { clinicId } = await params;
  const context = await getClinicContext(clinicId);

  if (!context) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 p-6">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Clínica atual
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {context.clinic.name}
          </h1>

          <p className="mt-2 text-muted-foreground">
            {context.access.scope === "global"
              ? "Acesso de administrador global"
              : `Perfil: ${context.access.role?.name ?? "Não identificado"}`}
          </p>
        </div>

        <Link
          href="/clinics"
          className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          Trocar clínica
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Painel principal</CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-sm text-muted-foreground">
            O contexto da clínica foi validado pelo backend. O menu do sistema
            será construído com base nas permissões deste acesso.
          </p>

          <p className="mt-4 text-sm">
            Permissões disponíveis:{" "}
            <span className="font-medium">
              {context.access.permissions.length}
            </span>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}