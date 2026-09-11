import { notFound, redirect } from "next/navigation";
import { GlobalUsersManager } from "@/components/admin/global-users-manager";
import { canAccessGlobalAdminPage } from "@/lib/admin/global-admin-contract";
import { getCurrentUser } from "@/lib/server/current-user";

export const metadata = {
  title: "Administração Global",
};

export default async function GlobalAdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (!canAccessGlobalAdminPage(user)) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">Escopo global</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Administração Global
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Gerencie identidades e convites sem depender de um contexto de consultório.
        </p>
      </div>

      <GlobalUsersManager />
    </main>
  );
}
