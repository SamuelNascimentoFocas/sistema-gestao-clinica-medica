"use client";

import { useCallback, useEffect, useState } from "react";
import { ClinicRoleFormDialog } from "@/components/administration/clinic-role-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";
import {
  parseClinicRolePermissionsResponse,
  parseClinicRoleResponse,
  parseClinicRolesResponse,
} from "@/lib/administration/role-contract";
import type { ClinicRole, ClinicRolePermission } from "@/types/administration";

type ClinicRolesManagerProps = {
  clinicId: string;
  onRolesChanged: () => void;
};

function responseMessage(body: unknown, fallback: string) {
  return typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
    ? body.message
    : fallback;
}

export function ClinicRolesManager({ clinicId, onRolesChanged }: ClinicRolesManagerProps) {
  const [roles, setRoles] = useState<ClinicRole[]>([]);
  const [permissions, setPermissions] = useState<ClinicRolePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleUnauthenticated = useCallback((response: BrowserResponse) => {
    if (response.status !== 401) return false;
    window.location.assign("/login");
    return true;
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    await Promise.resolve();
    if (signal?.aborted) return;

    setIsLoading(true);
    setErrorMessage(null);
    setRoles([]);
    setPermissions([]);

    try {
      const [rolesResponse, permissionsResponse] = await Promise.all([
        browserApi.get(`/api/clinics/${encodeURIComponent(clinicId)}/roles`, { signal }),
        browserApi.get(`/api/clinics/${encodeURIComponent(clinicId)}/roles/permissions`, { signal }),
      ]);

      if (signal?.aborted) return;

      if (handleUnauthenticated(rolesResponse) || handleUnauthenticated(permissionsResponse)) return;

      const [rolesBody, permissionsBody] = await Promise.all([
        readBrowserJson(rolesResponse).catch(() => null),
        readBrowserJson(permissionsResponse).catch(() => null),
      ]);

      if (!isSuccessfulResponse(rolesResponse)) {
        throw new Error(responseMessage(rolesBody, "Não foi possível carregar os perfis."));
      }
      if (!isSuccessfulResponse(permissionsResponse)) {
        throw new Error(
          responseMessage(permissionsBody, "Não foi possível carregar as permissões."),
        );
      }

      const parsedRoles = parseClinicRolesResponse(rolesBody);
      const parsedPermissions = parseClinicRolePermissionsResponse(permissionsBody);
      if (!parsedRoles || !parsedPermissions) throw new Error("O servidor retornou um catálogo de perfis inválido.");

      setRoles(parsedRoles);
      setPermissions(parsedPermissions);
    } catch (error) {
      if (signal?.aborted) return;
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar os perfis.");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [clinicId, handleUnauthenticated]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  function roleSaved(savedRole: ClinicRole) {
    setRoles((current) => {
      const exists = current.some((role) => role.id === savedRole.id);
      return exists
        ? current.map((role) => (role.id === savedRole.id ? savedRole : role))
        : [...current, savedRole].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    });
    setSuccessMessage("Perfil salvo.");
    setErrorMessage(null);
    onRolesChanged();
  }

  async function changeStatus(role: ClinicRole) {
    const nextStatus = !role.isActive;
    if (
      !nextStatus &&
      !window.confirm(
        "Desativar este perfil? Usuários vinculados deixarão de receber suas permissões, mas os vínculos serão preservados.",
      )
    ) {
      return;
    }

    setPendingRoleId(role.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.patch(
        `/api/clinics/${encodeURIComponent(clinicId)}/roles/${encodeURIComponent(role.id)}/status`,
        JSON.stringify({ isActive: nextStatus }),
        { headers: { "Content-Type": "application/json" } },
      );
      if (handleUnauthenticated(response)) return;

      const body: unknown = await readBrowserJson(response).catch(() => null);
      if (!isSuccessfulResponse(response)) {
        throw new Error(responseMessage(body, "Não foi possível alterar o status do perfil."));
      }

      const updatedRole = parseClinicRoleResponse(body);
      if (!updatedRole) throw new Error("O servidor retornou um perfil inválido.");

      setRoles((current) => current.map((item) => (item.id === updatedRole.id ? updatedRole : item)));
      setSuccessMessage(nextStatus ? "Perfil ativado." : "Perfil desativado.");
      onRolesChanged();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível alterar o status do perfil.");
    } finally {
      setPendingRoleId(null);
    }
  }

  return (
    <section aria-labelledby="clinic-roles-title" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="clinic-roles-title" className="text-xl font-semibold">Perfis de acesso</h2>
          <p className="text-sm text-muted-foreground">Perfis do sistema são somente leitura; perfis personalizados pertencem a esta clínica.</p>
        </div>
        <ClinicRoleFormDialog
          clinicId={clinicId}
          permissions={permissions}
          trigger={<Button disabled={isLoading}>Novo perfil</Button>}
          onSuccess={roleSaved}
        />
      </div>

      <div aria-live="polite" className="space-y-3">
        {errorMessage ? <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</div> : null}
        {successMessage ? <div role="status" className="rounded-lg border bg-background px-4 py-3 text-sm">{successMessage}</div> : null}
      </div>

      <Card>
        <CardHeader><CardTitle>Catálogo da clínica</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando perfis...</p>
          ) : roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum perfil disponível.</p>
          ) : (
            <div className="divide-y">
              {roles.map((role) => (
                <article key={role.id} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{role.name}</h3>
                      <span className="rounded-full border px-2 py-0.5 text-xs">{role.isSystem ? "Sistema" : "Personalizado"}</span>
                      <span className="rounded-full border px-2 py-0.5 text-xs">{role.isActive ? "Ativo" : "Inativo"}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{role.description || "Sem descrição."}</p>
                  </div>
                  <div className="flex flex-wrap content-start gap-2">
                    {role.permissions.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Sem permissões.</span>
                    ) : role.permissions.map((permission) => (
                      <span key={permission.id} title={permission.code} className="rounded-md bg-muted px-2 py-1 text-xs">{permission.description}</span>
                    ))}
                  </div>
                  {!role.isSystem ? (
                    <div className="flex gap-2 lg:justify-end">
                      <ClinicRoleFormDialog clinicId={clinicId} permissions={permissions} role={role} trigger={<Button type="button" variant="outline">Editar</Button>} onSuccess={roleSaved} />
                      <Button type="button" variant={role.isActive ? "destructive" : "outline"} disabled={pendingRoleId !== null} onClick={() => void changeStatus(role)}>
                        {pendingRoleId === role.id ? "Salvando..." : role.isActive ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground lg:text-right">Gerenciado pelo sistema</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
