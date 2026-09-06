"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { type FormEvent, useState } from "react";
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
  CLINIC_MEMBER_ROLES,
  isClinicMemberRoleCode,
  type ClinicMember,
  type ClinicMemberResponse,
  type ClinicMemberRoleCode,
} from "@/types/administration";

type ClinicMembersManagerProps = {
  clinicId: string;
  currentMembershipId: string | null;
  canCreate: boolean;
  canAssignRole: boolean;
  canChangeStatus: boolean;
};

type MemberStatusFilter = "all" | "active" | "inactive";

const INITIAL_FORM: MemberFormValues = {
  fullName: "",
  email: "",
  password: "",
  roleCode: "receptionist",
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

function getMembership(body: unknown): ClinicMember | null {
  if (
    typeof body !== "object" ||
    body === null ||
    !("membership" in body) ||
    typeof body.membership !== "object" ||
    body.membership === null
  ) {
    return null;
  }

  const membership = body.membership as Partial<ClinicMember>;

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
  canAssignRole,
  canChangeStatus,
}: ClinicMembersManagerProps) {
  const {
    control,
    register,
    reset,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isCreating },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: INITIAL_FORM,
  });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<ClinicMemberRoleCode | "all">("all");
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>("all");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, ClinicMemberRoleCode>>({});
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
          getResponseMessage(body, "Não foi possível cadastrar o usuário."),
        );
      }

      if (!getMembership(body)) {
        throw new Error("O servidor retornou um vínculo inválido.");
      }

      reset(INITIAL_FORM);
      setSearchInput("");
      setAppliedSearch("");
      setRoleFilter("all");
      setStatusFilter("all");
      setPage(1);
      reloadMembers();
      setSuccessMessage("Usuário cadastrado e vinculado à clínica.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o usuário.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRoleUpdate(member: ClinicMember) {
    const roleCode = roleDrafts[member.id] ?? member.role.code;

    if (roleCode === member.role.code) return;

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
        data: JSON.stringify({ roleCode }),
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
        [updatedMember.id]: updatedMember.role.code,
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
        [member.id]: member.role.code,
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
        </div>
      ),
    },
    {
      id: "role",
      header: "Perfil",
      cell: (member) => {
        const roleDraft = roleDrafts[member.id] ?? member.role.code;

        return (
          <div className="flex min-w-64 flex-col gap-2 sm:flex-row">
            <select
              aria-label={`Perfil de ${member.user.fullName}`}
              className="border-input bg-background h-9 min-w-0 flex-1 rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={!canAssignRole || isBusy}
              value={roleDraft}
              onChange={(event) => {
                const roleCode = event.target.value;
                if (isClinicMemberRoleCode(roleCode)) {
                  setRoleDrafts((current) => ({
                    ...current,
                    [member.id]: roleCode,
                  }));
                }
              }}
            >
              {CLINIC_MEMBER_ROLES.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.label}
                </option>
              ))}
            </select>

            {canAssignRole ? (
              <Button
                type="button"
                variant="outline"
                disabled={isBusy || roleDraft === member.role.code}
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
      cell: (member) =>
        canChangeStatus ? (
          <div>
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
            {!member.user.isActive ? (
              <p className="mt-2 max-w-48 text-xs text-muted-foreground">
                O vínculo depende da ativação global do usuário.
              </p>
            ) : null}
          </div>
        ) : null,
    },
  ];

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium text-muted-foreground">Administração</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Usuários e perfis</h1>
        <p className="mt-2 text-muted-foreground">
          Cadastre usuários e controle seus vínculos com esta clínica.
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
              <CardTitle>Cadastrar usuário</CardTitle>
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
                  <Label htmlFor="member-password">Senha inicial</Label>
                  <Controller
                    control={control}
                    name="password"
                    render={({ field }) => (
                      <Input
                        {...field}
                        aria-invalid={!!errors.password}
                        aria-describedby={errors.password ? "member-password-error" : undefined}
                        id="member-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={72}
                      />
                    )}
                  />
                  <FormFieldError id="member-password-error" message={errors.password?.message} />
                  <p className="text-xs text-muted-foreground">Use ao menos 12 caracteres.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="member-role">Perfil</Label>
                  <select
                    {...register("roleCode")}
                    aria-invalid={!!errors.roleCode}
                    aria-describedby={errors.roleCode ? "member-role-error" : undefined}
                    id="member-role"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {CLINIC_MEMBER_ROLES.map((role) => (
                      <option key={role.code} value={role.code}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <FormFieldError id="member-role-error" message={errors.roleCode?.message} />
                </div>

                <div className="md:col-span-2">
                  <Button type="submit" disabled={isBusy}>
                    {pendingAction === "create" ? "Cadastrando..." : "Cadastrar e vincular"}
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

              <div className="space-y-2">
                <Label htmlFor="member-role-filter">Perfil</Label>
                <select
                  id="member-role-filter"
                  value={roleFilter}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(event) => {
                    const value = event.target.value;
                    setRoleFilter(isClinicMemberRoleCode(value) ? value : "all");
                    setPage(1);
                  }}
                >
                  <option value="all">Todos</option>
                  {CLINIC_MEMBER_ROLES.map((role) => (
                    <option key={role.code} value={role.code}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

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
                roleCode: roleFilter === "all" ? undefined : roleFilter,
                isActive:
                  statusFilter === "all" ? undefined : statusFilter === "active",
              }}
              page={page}
              refreshKey={refreshKey}
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
    </main>
  );
}
