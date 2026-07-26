"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  Clock,
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type ClinicAppShellProps = {
  children: ReactNode;
  clinicId: string;
  clinicName: string;
  accessLabel: string;
  permissions: string[];
};

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permissions: string[];
};

export function ClinicAppShell({
  children,
  clinicId,
  clinicName,
  accessLabel,
  permissions,
}: ClinicAppShellProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const basePath = `/clinics/${clinicId}`;

  const navigationItems: NavigationItem[] = [
    {
      label: "Painel",
      href: `${basePath}/dashboard`,
      icon: LayoutDashboard,
      permissions: [],
    },
    {
      label: "Agendamentos",
      href: `${basePath}/appointments`,
      icon: CalendarDays,
      permissions: ["appointments.read"],
    },
    {
      label: "Pacientes",
      href: `${basePath}/patients`,
      icon: Users,
      permissions: ["patients.read"],
    },
    {
      label: "Profissionais",
      href: `${basePath}/professionals`,
      icon: Stethoscope,
      permissions: ["professionals.read"],
    },
    {
      label: "Agendas",
      href: `${basePath}/schedules`,
      icon: Clock,
      permissions: ["schedules.read"],
    },
    {
      label: "Prontuários",
      href: `${basePath}/medical-records`,
      icon: FileText,
      permissions: ["medical_records.read"],
    },
    {
      label: "Administração",
      href: `${basePath}/administration`,
      icon: Settings,
      permissions: [
        "clinics.update",
        "users.read",
        "users.create",
        "users.update",
        "users.assign_role",
        "professionals.create",
        "professionals.update",
      ],
    },
    {
      label: "Auditoria",
      href: `${basePath}/audit-logs`,
      icon: ShieldCheck,
      permissions: ["audit_logs.read"],
    },
  ].filter((item) =>
    hasAnyPermission(permissions, item.permissions),
  );

  function renderNavigation() {
    return navigationItems.map((item) => {
      const Icon = item.icon;
      const isActive =
        pathname === item.href || pathname.startsWith(`${item.href}/`);

      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          onClick={() => setIsMobileMenuOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span>{item.label}</span>
        </Link>
      );
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-muted/30">
      <aside className="hidden w-72 shrink-0 flex-col border-r bg-background lg:flex">
        <div className="border-b px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-5" aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Clínica atual
              </p>
              <p className="mt-1 truncate font-semibold">{clinicName}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {accessLabel}
              </p>
            </div>
          </div>
        </div>

        <nav
          aria-label="Navegação da clínica"
          className="flex-1 space-y-1 overflow-y-auto p-3"
        >
          {renderNavigation()}
        </nav>

        <div className="border-t p-3">
          <Link
            href="/clinics"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Building2 className="size-4" aria-hidden="true" />
            Trocar clínica
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-16 z-30 flex items-center border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Abrir menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>

          <div className="min-w-0 flex-1 px-3">
            <p className="truncate text-sm font-semibold">{clinicName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {accessLabel}
            </p>
          </div>
        </div>

        {children}
      </div>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <aside className="relative flex h-full w-[min(20rem,85vw)] flex-col bg-background shadow-xl">
            <div className="flex items-start justify-between border-b p-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Clínica atual
                </p>
                <p className="mt-1 truncate font-semibold">{clinicName}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {accessLabel}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Fechar menu"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="size-5" aria-hidden="true" />
              </Button>
            </div>

            <nav
              aria-label="Navegação móvel da clínica"
              className="flex-1 space-y-1 overflow-y-auto p-3"
            >
              {renderNavigation()}
            </nav>

            <div className="border-t p-3">
              <Link
                href="/clinics"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Building2 className="size-4" aria-hidden="true" />
                Trocar clínica
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}