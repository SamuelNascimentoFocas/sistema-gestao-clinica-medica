"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  Clock,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { hasAnyPermission } from "@/lib/auth/permissions";

type ClinicAppShellProps = {
  children: ReactNode;
  clinicId: string;
  clinicName: string;
  accessLabel: string;
  permissions: string[];
  clinicSwitcher?: ReactNode;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permissions: string[];
};

type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

function ClinicShellContent({
  children,
  clinicId,
  clinicName,
  accessLabel,
  permissions,
  clinicSwitcher,
}: ClinicAppShellProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const basePath = `/clinics/${clinicId}`;

  const navigationSections: NavigationSection[] = [
    {
      label: "Visão geral",
      items: [
        {
          label: "Painel",
          href: `${basePath}/dashboard`,
          icon: LayoutDashboard,
          permissions: [],
        },
      ],
    },
    {
      label: "Atendimento",
      items: [
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
      ],
    },
    {
      label: "Gestão",
      items: [
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
            "roles.manage",
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
      ],
    },
  ]
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        hasAnyPermission(permissions, item.permissions),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      <Sidebar
        collapsible="icon"
        style={{
          top: "4rem",
          height: "calc(100svh - 4rem)",
        }}
      >
        <SidebarHeader className="border-b border-sidebar-border">
          {clinicSwitcher ?? (
            <div className="flex h-12 items-center gap-2 overflow-hidden rounded-md p-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0">
              <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2 className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
                <span className="block truncate text-sm font-medium">
                  {clinicName}
                </span>
                <span className="block truncate text-xs text-sidebar-foreground/70">
                  {accessLabel}
                </span>
              </span>
            </div>
          )}
        </SidebarHeader>

        <SidebarContent>
          {navigationSections.map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={
                            <Link
                              href={item.href}
                              aria-current={isActive ? "page" : undefined}
                              onClick={() => setOpenMobile(false)}
                            />
                          }
                          isActive={isActive}
                          tooltip={item.label}
                        >
                          <Icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link
                    href="/clinics"
                    onClick={() => setOpenMobile(false)}
                  />
                }
                tooltip="Trocar clínica"
              >
                <Building2 aria-hidden="true" />
                <span>Trocar clínica</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <div className="sticky top-16 z-30 flex min-h-12 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{clinicName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {accessLabel}
            </p>
          </div>
        </div>

        {children}
      </SidebarInset>
    </>
  );
}

export function ClinicAppShell(props: ClinicAppShellProps) {
  return (
    <SidebarProvider className="min-h-[calc(100vh-4rem)]">
      <ClinicShellContent {...props} />
    </SidebarProvider>
  );
}
