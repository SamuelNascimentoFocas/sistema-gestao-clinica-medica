"use client"

import Link from "next/link"
import { Building2Icon, CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import type { AccessibleClinic } from "@/types/clinic"

type ClinicSwitcherProps = {
  currentClinic: AccessibleClinic
  accessibleClinics: AccessibleClinic[]
}

function getClinicAccessLabel(access: AccessibleClinic["access"]) {
  if (access.scope === "global") {
    return "Administrador global"
  }

  return access.role?.name ?? "Perfil não identificado"
}

function getClinicDashboardHref(clinicId: string) {
  return `/clinics/${encodeURIComponent(clinicId)}/dashboard`
}

function ClinicIdentity({ entry }: { entry: AccessibleClinic }) {
  return (
    <>
      <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Building2Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-left text-sm leading-tight">
        <span className="block truncate font-medium">{entry.clinic.name}</span>
        <span className="block truncate text-xs text-sidebar-foreground/70">
          {getClinicAccessLabel(entry.access)}
        </span>
      </span>
    </>
  )
}

export function ClinicSwitcher({
  currentClinic,
  accessibleClinics,
}: ClinicSwitcherProps) {
  const { isMobile } = useSidebar()

  if (accessibleClinics.length <= 1) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div
            data-slot="clinic-switcher-current"
            className="flex h-12 w-full items-center gap-2 overflow-hidden rounded-md p-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 [&>span:last-child]:group-data-[collapsible=icon]:hidden"
          >
            <ClinicIdentity entry={currentClinic} />
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={currentClinic.clinic.name}
                aria-label={`Trocar clínica. Clínica atual: ${currentClinic.clinic.name}`}
              />
            }
          >
            <ClinicIdentity entry={currentClinic} />
            <ChevronsUpDownIcon
              className="ml-auto size-4 group-data-[collapsible=icon]:hidden"
              aria-hidden="true"
            />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="start"
            className="min-w-64"
          >
            <DropdownMenuLabel>Clínicas disponíveis</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {accessibleClinics.map((entry) => {
              const isCurrent = entry.clinic.id === currentClinic.clinic.id

              return (
                <DropdownMenuLinkItem
                  key={entry.clinic.id}
                  render={
                    <Link href={getClinicDashboardHref(entry.clinic.id)} />
                  }
                  closeOnClick
                  aria-current={isCurrent ? "page" : undefined}
                  className="gap-3 py-2"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                    <Building2Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {entry.clinic.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {getClinicAccessLabel(entry.access)}
                    </span>
                  </span>
                  {isCurrent ? (
                    <CheckIcon className="ml-auto size-4" aria-hidden="true" />
                  ) : null}
                </DropdownMenuLinkItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
