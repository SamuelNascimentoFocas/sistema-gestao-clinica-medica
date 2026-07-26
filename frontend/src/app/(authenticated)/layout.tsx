import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/current-user";
import { LogoutButton } from "@/components/auth/logout-button";

type AuthenticatedLayoutProps = {
  children: ReactNode;
};

export default async function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-6">
          <div>
            <p className="font-semibold">Sistema da Clínica</p>
            <p className="text-sm text-muted-foreground">
              Gestão clínica e administrativa
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.fullName}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>

            <LogoutButton />
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}