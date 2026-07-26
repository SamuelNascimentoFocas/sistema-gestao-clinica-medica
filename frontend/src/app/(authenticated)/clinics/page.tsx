import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessibleClinics } from "@/lib/server/clinic-access";

export const metadata = {
  title: "Selecionar clínica",
};

export default async function ClinicsPage() {
  const accessibleClinics = await getAccessibleClinics();

  if (!accessibleClinics) {
    redirect("/login");
  }

  if (accessibleClinics.length === 1) {
    redirect(`/clinics/${accessibleClinics[0].clinic.id}/dashboard`);
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 p-6">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">
          Contexto de trabalho
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Selecione uma clínica
        </h1>

        <p className="mt-2 text-muted-foreground">
          Escolha a unidade que deseja acessar.
        </p>
      </div>

      {accessibleClinics.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma clínica disponível</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sua conta não possui acesso a nenhuma clínica ativa.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accessibleClinics.map(({ clinic, access }) => (
            <Card key={clinic.id}>
              <CardHeader>
                <CardTitle>{clinic.name}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p>
                    Perfil:{" "}
                    <span className="font-medium text-foreground">
                      {access.scope === "global"
                        ? "Administrador global"
                        : access.role?.name}
                    </span>
                  </p>

                  {clinic.addressCity ? (
                    <p>
                      Localização: {clinic.addressCity}
                      {clinic.addressState
                        ? ` — ${clinic.addressState}`
                        : ""}
                    </p>
                  ) : null}
                </div>

                <Link
                  href={`/clinics/${clinic.id}/dashboard`}
                  className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Acessar clínica
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}