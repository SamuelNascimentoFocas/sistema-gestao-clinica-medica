import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Painel",
};

export default function ClinicDashboardPage() {
  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium text-muted-foreground">
          Visão geral
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Painel principal
        </h1>

        <p className="mt-2 text-muted-foreground">
          Acompanhe os principais módulos e atividades da clínica.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agendamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                A agenda clínica será apresentada neste painel.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pacientes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Cadastros e atividades recentes serão resumidos aqui.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profissionais</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Informações operacionais dos profissionais ficarão disponíveis.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}