"use client";

import { useState, type FormEvent } from "react";
import { GlobalUserEditDialog } from "@/components/admin/global-user-edit-dialog";
import { GlobalUserInvitationDialog } from "@/components/admin/global-user-invitation-dialog";
import {
  RemoteDataTable,
  type RemoteDataTableColumn,
} from "@/components/data-table/remote-data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  parseGlobalUserResponse,
  parseGlobalUsersResponse,
  parseGlobalUserStatusResponse,
} from "@/lib/admin/global-admin-contract";
import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";
import {
  canResendInvitation,
  invitationStatusLabel,
} from "@/lib/invitations/invitation-contract";
import type { ClinicMemberUser } from "@/types/administration";

type UserStatusFilter = "all" | "active" | "inactive";

function responseMessage(value: unknown, fallback: string) {
  return typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message
    : fallback;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

export function GlobalUsersManager() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function reloadUsers() {
    setRefreshKey((current) => current + 1);
  }

  function handleSuccess(message: string) {
    setErrorMessage(null);
    setSuccessMessage(message);
    reloadUsers();
  }

  async function readResponse(response: BrowserResponse) {
    return readBrowserJson(response).catch(() => null) as Promise<unknown>;
  }

  function handleUnauthenticated(response: BrowserResponse) {
    if (response.status !== 401) return false;
    window.location.assign("/login");
    return true;
  }

  async function handleStatusUpdate(user: ClinicMemberUser) {
    const isActive = !user.isActive;
    const action = isActive ? "ativar" : "inativar";
    if (!window.confirm(`Confirma ${action} o usuário ${user.fullName}?`)) return;

    setPendingAction(`status:${user.id}`);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await browserApi.request<string>({
        url: "/api/admin/users/" + encodeURIComponent(user.id) + "/status",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ isActive }),
      });
      if (handleUnauthenticated(response)) return;
      const body = await readResponse(response);
      if (!isSuccessfulResponse(response)) {
        throw new Error(responseMessage(body, "Não foi possível alterar o status."));
      }
      if (!parseGlobalUserStatusResponse(body)) {
        throw new Error("O servidor retornou um usuário inválido.");
      }
      handleSuccess(isActive ? "Usuário ativado." : "Usuário inativado.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível alterar o status.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleInvitationResend(user: ClinicMemberUser) {
    setPendingAction(`resend:${user.id}`);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await browserApi.request<string>({
        url:
          "/api/admin/users/" +
          encodeURIComponent(user.id) +
          "/invitations/resend",
        method: "POST",
      });
      if (handleUnauthenticated(response)) return;
      const body = await readResponse(response);
      if (!isSuccessfulResponse(response)) {
        throw new Error(responseMessage(body, "Não foi possível reenviar o convite."));
      }
      if (!parseGlobalUserResponse(body)) {
        throw new Error("O servidor retornou um convite inválido.");
      }
      handleSuccess("Novo convite enviado.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível reenviar o convite.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setAppliedSearch("");
    setStatusFilter("all");
    setPage(1);
  }

  const isBusy = pendingAction !== null;
  const hasFilters = appliedSearch.length > 0 || statusFilter !== "all";
  const columns: RemoteDataTableColumn<ClinicMemberUser>[] = [
    {
      id: "identity",
      header: "Usuário",
      cell: (user) => (
        <div className="min-w-44">
          <p className="font-medium">{user.fullName}</p>
          <p className="break-all text-xs text-muted-foreground">{user.email}</p>
          {user.isGlobalAdmin ? (
            <p className="mt-1 text-xs font-medium">Administrador global</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "accountStatus",
      header: "Conta",
      className: "hidden sm:table-cell",
      cell: (user) => (
        <div className="min-w-24">
          <p className={user.isActive ? "text-foreground" : "text-destructive"}>
            {user.isActive ? "Ativa" : "Inativa"}
          </p>
          <p className="text-xs text-muted-foreground">
            {user.passwordConfigured ? "Senha configurada" : "Sem senha"}
          </p>
        </div>
      ),
    },
    {
      id: "invitation",
      header: "Onboarding",
      className: "hidden md:table-cell",
      cell: (user) => (
        <div className="min-w-36">
          <p>{invitationStatusLabel(user.invitationStatus)}</p>
          <p className="text-xs text-muted-foreground">
            Enviado: {formatDateTime(user.invitationSentAt)}
          </p>
          <p className="text-xs text-muted-foreground">
            Expira: {formatDateTime(user.invitationExpiresAt)}
          </p>
        </div>
      ),
    },
    {
      id: "lastLogin",
      header: "Último acesso",
      className: "hidden xl:table-cell",
      cell: (user) => formatDateTime(user.lastLoginAt),
    },
    {
      id: "actions",
      header: "Ações",
      className: "w-px",
      cell: (user) => {
        const canResend = canResendInvitation(user);
        const canChangeStatus = !user.isGlobalAdmin || !user.isActive;
        return (
          <div className="flex min-w-32 flex-col gap-2">
            <GlobalUserEditDialog
              user={user}
              disabled={isBusy}
              onSuccess={() => handleSuccess("Usuário atualizado.")}
            />
            {canResend ? (
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => void handleInvitationResend(user)}
              >
                {pendingAction === `resend:${user.id}`
                  ? "Reenviando..."
                  : "Reenviar convite"}
              </Button>
            ) : null}
            {canChangeStatus ? (
              <Button
                type="button"
                variant={user.isActive ? "destructive" : "outline"}
                disabled={isBusy}
                onClick={() => void handleStatusUpdate(user)}
              >
                {pendingAction === `status:${user.id}`
                  ? "Salvando..."
                  : user.isActive
                    ? "Inativar"
                    : "Ativar"}
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <section aria-labelledby="global-users-title" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="global-users-title" className="text-xl font-semibold">
            Usuários
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Convide usuários e administre identidade, onboarding e status da conta.
          </p>
        </div>
        <GlobalUserInvitationDialog
          onSuccess={() => handleSuccess("Usuário convidado.")}
        />
      </div>

      <div aria-live="polite" className="space-y-3">
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div role="status" className="rounded-lg border bg-background px-4 py-3 text-sm">
            {successMessage}
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pesquisar usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
            onSubmit={applySearch}
          >
            <div className="space-y-2">
              <Label htmlFor="global-user-search">Pesquisa</Label>
              <Input
                id="global-user-search"
                value={searchInput}
                maxLength={254}
                placeholder="Nome ou e-mail"
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="global-user-status-filter">Status</Label>
              <select
                id="global-user-status-filter"
                value={statusFilter}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => {
                  setStatusFilter(event.target.value as UserStatusFilter);
                  setPage(1);
                }}
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Pesquisar</Button>
              {hasFilters ? (
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Limpar
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuários cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <RemoteDataTable
            route="/api/admin/users"
            columns={columns}
            query={{
              search: appliedSearch || undefined,
              isActive:
                statusFilter === "all" ? undefined : statusFilter === "active",
            }}
            page={page}
            refreshKey={refreshKey}
            parseResponse={parseGlobalUsersResponse}
            getRowId={(user) => user.id}
            onPageChange={setPage}
            summary={(meta) =>
              meta.total === 1
                ? "1 usuário encontrado"
                : `${meta.total} usuários encontrados`
            }
            emptyTitle="Nenhum usuário encontrado"
            emptyDescription={
              hasFilters
                ? "Revise a pesquisa ou limpe os filtros."
                : "Ainda não há usuários cadastrados."
            }
          />
        </CardContent>
      </Card>
    </section>
  );
}
