"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  RemoteDataTable,
  type RemoteDataTableColumn,
} from "@/components/data-table/remote-data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFieldError } from "@/components/ui/form-field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";
import {
  memberFormSchema,
  type MemberFormValues,
} from "@/lib/forms/form-schemas";
import {
  isUuid,
  parseClinicRolesResponse,
  rolesForMembershipSelect,
} from "@/lib/administration/role-contract";
import {
  canResendInvitation,
  invitationStatusLabel,
  parseClinicMembersResponse,
  parseInvitedUserResponse,
} from "@/lib/invitations/invitation-contract";
import {
  type ClinicMember,
  type ClinicMemberMutation,
  type ClinicMemberResponse,
  type ClinicRole,
} from "@/types/administration";

type ClinicMembersManagerProps = {
  clinicId: string;
  currentMembershipId: string | null;
  canCreate: boolean;
  canResendInvitations: boolean;
  canAssignRole: boolean;
  canChangeStatus: boolean;
  assignableRolesRefreshKey: number;
};

type MemberStatusFilter = "all" | "active" | "inactive";

const INITIAL_FORM: MemberFormValues = {
  fullName: "",
  email: "",
  roleId: "",
};

function getResponseMessage(body: unknown, fallback: string) {
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return fallback;
}

function getMembership(body: unknown): ClinicMemberMutation | null {
  if (
    typeof body !== "object" ||
    body === null ||
    !("membership" in body) ||
    typeof body.membership !== "object" ||
    body.membership === null
  ) {
    return null;
  }

  const membership = body.membership as Partial<ClinicMemberMutation>;

  if (
    typeof membership.id !== "string" ||
    typeof membership.user !== "object" ||
    membership.user === null ||
    typeof membership.role !== "object" ||
    membership.role === null
  ) {
    return null;
  }

  return (body as ClinicMemberResponse).membership;
}

export function ClinicMembersManager({
  clinicId,
  currentMembershipId,
  canCreate,
  canResendInvitations,
  canAssignRole,
  canChangeStatus,
  assignableRolesRefreshKey,
}: ClinicMembersManagerProps) {
  const {
    control,
    register,
    reset,
    getValues,
    setValue,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isCreating },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: INITIAL_FORM,
  });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>("all");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const [assignableRoles, setAssignableRoles] = useState<ClinicRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(canAssignRole);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  async function readResponse(response: BrowserResponse) {
    return readBrowserJson(response).catch(() => null) as Promise<unknown>;
  }

  function handleUnauthenticated(response: BrowserResponse) {
    if (response.status === 401) {
      window.location.assign("/login");
      return true;
    }

    return false;
  }

  function reloadMembers() {
    setRefreshKey((current) => current + 1);
  }

  const loadAssignableRoles = useCallback(async (signal?: AbortSignal) => {
    await Promise.resolve();
    if (signal?.aborted) return;

    if (!canAssignRole) {
      setAssignableRoles([]);
      setRolesLoading(false);
      return;
    }

    setRolesLoading(true);
    setAssignableRoles([]);

    try {
      const response = await browserApi.get(
        `/api/clinics/${encodeURIComponent(clinicId)}/roles/assignable`,
        { signal },
      );

      if (signal?.aborted) return;

      if (handleUnauthenticated(response)) return;

      const body = await readResponse(response);
      if (!isSuccessfulResponse(response)) {
        throw new Error(
          getResponseMessage(body, "Não foi possível carregar os perfis atribuíveis."),
        );
      }

      const roles = parseClinicRolesResponse(body);
      if (!roles) throw new Error("O servidor retornou perfis atribuíveis inválidos.");

      setAssignableRoles(roles);
      setRoleFilter((current) =>
        current !== "all" && !roles.some((role) => role.id === current)
          ? "all"
          : current,
      );
      const currentRoleId = getValues("roleId");
      if (!roles.some((role) => role.id === currentRoleId)) {
        setValue("roleId", roles[0]?.id ?? "");
      }
    } catch (error) {
      if (signal?.aborted) return;
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os perfis atribuíveis.",
      );
    } finally {
      if (!signal?.aborted) setRolesLoading(false);
    }
  }, [canAssignRole, clinicId, getValues, setValue]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadAssignableRoles(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [assignableRolesRefreshKey, loadAssignableRoles]);

  async function handleCreate(form: MemberFormValues) {
    setPendingAction("create");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(clinicId)}/members`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(form),
      });

      if (handleUnauthenticated(response)) return;

      const body = await readResponse(response);

      if (!isSuccessfulResponse(response)) {
        throw new Error(
          getResponseMessage(body, "Não foi possível convidar o usuário."),
        );
      }

      if (!parseInvitedUserResponse(body)) {
        throw new Error("O servidor retornou um convite inválido.");
      }

      reset({ ...INITIAL_FORM, roleId: assignableRoles[0]?.id ?? "" });
      setSearchInput("");
      setAppliedSearch("");
      setRoleFilter("all");
      setStatusFilter("all");
      setPage(1);
      reloadMembers();
      setSuccessMessage("Usuário convidado e vinculado à clínica.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível convidar o usuário.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleInvitationResend(member: ClinicMember) {
    setPendingAction(`resend:${member.id}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/members/${encodeURIComponent(member.id)}/invitations/resend`,
        method: "POST",
      });

      if (handleUnauthenticated(response)) return;

      const body = await readResponse(response);
      if (!isSuccessfulResponse(response)) {
        throw new Error(
          getResponseMessage(body, "Não foi possível reenviar o convite."),
        );
      }

      if (!parseInvitedUserResponse(body)) {
        throw new Error("O servidor retornou um convite inválido.");
      }

      reloadMembers();
      setSuccessMessage("Novo convite enviado.");
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

  async function handleRoleUpdate(member: ClinicMember) {
    const roleId = roleDrafts[member.id] ?? member.role.id;

    if (roleId === member.role.id) return;

    setPendingAction(`role:${member.id}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/members/${encodeURIComponent(member.id)}/role`,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ roleId }),
      });

      if (handleUnauthenticated(response)) return;

      const body = await readResponse(response);

      if (!isSuccessfulResponse(response)) {
        throw new Error(
          getResponseMessage(body, "Não foi possível alterar o perfil."),
        );
      }

      const updatedMember = getMembership(body);

      if (!updatedMember) {
        throw new Error("O servidor retornou um vínculo inválido.");
      }

      setRoleDrafts((current) => ({
        ...current,
        [updatedMember.id]: updatedMember.role.id,
      }));

      if (member.id === currentMembershipId) {
        window.location.assign("/clinics");
        return;
      }

      reloadMembers();
      setSuccessMessage("Perfil atualizado.");
    } catch (error) {
      setRoleDrafts((current) => ({
        ...current,
        [member.id]: member.role.id,
      }));
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível alterar o perfil.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleStatusUpdate(member: ClinicMember) {
    const nextStatus = !member.isActive;

    setPendingAction(`status:${member.id}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/members/${encodeURIComponent(member.id)}/status`,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ isActive: nextStatus }),
      });

      if (handleUnauthenticated(response)) return;

      const body = await readResponse(response);

      if (!isSuccessfulResponse(response)) {
        throw new Error(
          getResponseMessage(body, "Não foi possível alterar o status."),
        );
      }

      if (!getMembership(body)) {
        throw new Error("O servidor retornou um vínculo inválido.");
      }

      if (member.id === currentMembershipId) {
        window.location.assign("/clinics");
        return;
      }

      reloadMembers();
      setSuccessMessage(nextStatus ? "Vínculo ativado." : "Vínculo inativado.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível alterar o status.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setAppliedSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setPage(1);
  }

  const hasFilters =
    appliedSearch.length > 0 || roleFilter !== "all" || statusFilter !== "all";
  const isBusy = pendingAction !== null || isCreating;
  const columns: RemoteDataTableColumn<ClinicMember>[] = [
    {
      id: "member",
      header: "Membro",
      cell: (member) => (
        <div className="min-w-48">
          <p className="font-medium">{member.user.fullName}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {member.user.email}
          </p>
          {member.id === currentMembershipId ? (
            <span className="mt-2 inline-block rounded-full border px-2 py-0.5 text-xs">
              Seu vínculo
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (member) => (
        <div className="space-y-1 whitespace-nowrap text-xs">
          <p>Vínculo: {member.isActive ? "ativo" : "inativo"}</p>
          <p>Usuário: {member.user.isActive ? "ativo" : "inativo"}</p>
          <p>
            Senha: {member.user.passwordConfigured ? "configurada" : "não configurada"}
          </p>
          <p>{invitationStatusLabel(member.user.invitationStatus)}</p>
          {member.user.invitationSentAt ? (
            <p>
              Enviado em {new Date(member.user.invitationSentAt).toLocaleString("pt-BR")}
            </p>
          ) : null}
          {member.user.invitationExpiresAt && !member.user.passwordConfigured ? (
            <p>
              Expira em {new Date(member.user.invitationExpiresAt).toLocaleString("pt-BR")}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "role",
      header: "Perfil",
      cell: (member) => {
        const roleDraft = roleDrafts[member.id] ?? member.role.id;
        const roleOptions = rolesForMembershipSelect(assignableRoles, member.role);

        return (
          <div className="flex min-w-64 flex-col gap-2 sm:flex-row">
            <select
              aria-label={`Perfil de ${member.user.fullName}`}
              className="border-input bg-background h-9 min-w-0 flex-1 rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={!canAssignRole || isBusy || rolesLoading}
              value={roleDraft}
              onChange={(event) => {
                const roleId = event.target.value;
                if (isUuid(roleId)) {
                  setRoleDrafts((current) => ({
                    ...current,
                    [member.id]: roleId,
                  }));
                }
              }}
            >
              {roleOptions.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                  {!assignableRoles.some((candidate) => candidate.id === role.id)
                    ? " (perfil atual indisponível)"
                    : ""}
                </option>
              ))}
            </select>

            {canAssignRole ? (
              <Button
                type="button"
                variant="outline"
                disabled={isBusy || roleDraft === member.role.id}
                onClick={() => void handleRoleUpdate(member)}
              >
                {pendingAction === `role:${member.id}` ? "Salvando..." : "Salvar"}
              </Button>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Ações",
      className: "w-px",
      cell: (member) => {
        const showResend =
          canResendInvitations && canResendInvitation(member.user);

        if (!canChangeStatus && !showResend) return null;

        return (
          <div className="space-y-2">
            {showResend ? (
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => void handleInvitationResend(member)}
              >
                {pendingAction === `resend:${member.id}`
                  ? "Reenviando..."
                  : "Reenviar convite"}
              </Button>
            ) : null}

            {canChangeStatus ? (
              <Button
                type="button"
                variant={member.isActive ? "destructive" : "outline"}
                disabled={isBusy || (!member.isActive && !member.user.isActive)}
                onClick={() => void handleStatusUpdate(member)}
              >
                {pendingAction === `status:${member.id}`
                  ? "Salvando..."
                  : member.isActive
                    ? "Inativar"
                    : "Ativar"}
              </Button>
            ) : null}
            {!member.user.isActive ? (
              <p className="mt-2 max-w-48 text-xs text-muted-foreground">
                O vínculo depende da ativação global do usuário.
              </p>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <section aria-labelledby="clinic-members-title">
      <div>
        <h2 id="clinic-members-title" className="text-xl font-semibold">Usuários e vínculos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Convide usuários e controle seus vínculos com esta clínica. Cada usuário define a própria senha.
        </p>

        <div aria-live="polite" className="mt-6 space-y-3">
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

        {canCreate ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Convidar usuário</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 md:grid-cols-2"
                onSubmit={submitForm(handleCreate)}
              >
                <div className="space-y-2">
                  <Label htmlFor="member-full-name">Nome completo</Label>
                  <Controller
                    control={control}
                    name="fullName"
                    render={({ field }) => (
                      <Input
                        {...field}
                        aria-invalid={!!errors.fullName}
                        aria-describedby={errors.fullName ? "member-full-name-error" : undefined}
                        id="member-full-name"
                        autoComplete="name"
                        required
                        minLength={3}
                        maxLength={180}
                      />
                    )}
                  />
                  <FormFieldError id="member-full-name-error" message={errors.fullName?.message} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="member-email">E-mail</Label>
                  <Controller
                    control={control}
                    name="email"
                    render={({ field }) => (
                      <Input
                        {...field}
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? "member-email-error" : undefined}
                        id="member-email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                      />
                    )}
                  />
                  <FormFieldError id="member-email-error" message={errors.email?.message} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="member-role">Perfil</Label>
                  <select
                    {...register("roleId")}
                    aria-invalid={!!errors.roleId}
                    aria-describedby={errors.roleId ? "member-role-error" : undefined}
                    id="member-role"
                    disabled={rolesLoading || assignableRoles.length === 0}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {assignableRoles.length === 0 ? (
                      <option value="">Nenhum perfil atribuível</option>
                    ) : null}
                    {assignableRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <FormFieldError id="member-role-error" message={errors.roleId?.message} />
                </div>

                <div className="md:col-span-2">
                  <Button type="submit" disabled={isBusy || rolesLoading || assignableRoles.length === 0}>
                    {pendingAction === "create" ? "Enviando convite..." : "Convidar e vincular"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Pesquisar membros</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_180px_auto]"
              onSubmit={handleSearch}
            >
              <div className="space-y-2">
                <Label htmlFor="member-search">Pesquisa</Label>
                <Input
                  id="member-search"
                  value={searchInput}
                  maxLength={180}
                  placeholder="Nome ou e-mail"
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </div>

              {canAssignRole ? (
                <div className="space-y-2">
                  <Label htmlFor="member-role-filter">Perfil</Label>
                  <select
                    id="member-role-filter"
                    value={roleFilter}
                    disabled={rolesLoading}
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onChange={(event) => {
                      const value = event.target.value;
                      setRoleFilter(value === "all" || isUuid(value) ? value : "all");
                      setPage(1);
                    }}
                  >
                    <option value="all">Todos</option>
                    {assignableRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="member-status-filter">Status</Label>
                <select
                  id="member-status-filter"
                  value={statusFilter}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(event) => {
                    setStatusFilter(event.target.value as MemberStatusFilter);
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

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Membros da clínica</CardTitle>
          </CardHeader>
          <CardContent>
            <RemoteDataTable
              route={`/api/clinics/${encodeURIComponent(clinicId)}/members`}
              columns={columns}
              query={{
                search: appliedSearch || undefined,
                roleId: roleFilter === "all" ? undefined : roleFilter,
                isActive:
                  statusFilter === "all" ? undefined : statusFilter === "active",
              }}
              page={page}
              refreshKey={refreshKey}
              parseResponse={parseClinicMembersResponse}
              getRowId={(member) => member.id}
              onPageChange={setPage}
              summary={(meta) =>
                meta.total === 1 ? "1 vínculo encontrado" : `${meta.total} vínculos encontrados`
              }
              emptyTitle="Nenhum membro encontrado"
              emptyDescription={
                hasFilters
                  ? "Revise os termos da pesquisa ou limpe os filtros."
                  : "Ainda não há usuários vinculados a esta clínica."
              }
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
