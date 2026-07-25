export const metadata = {
  title: "Painel",
};

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 p-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          Sistema de gestão da clínica
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Painel principal
        </h1>

        <p className="mt-3 text-muted-foreground">
          Sua sessão está autenticada e esta área só pode ser acessada por um
          usuário com token válido.
        </p>
      </div>
    </main>
  );
}