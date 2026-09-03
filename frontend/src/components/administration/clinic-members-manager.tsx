"use client";

import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";

import {
  useState,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CLINIC_MEMBER_ROLES,
  isClinicMemberRoleCode,
  type ClinicMember,
  type ClinicMemberResponse,
  type ClinicMemberRoleCode,
} from "@/types/administration";

type ClinicMembersManagerProps = {
  clinicId: string;
  initialMembers: ClinicMember[];
  currentMembershipId: string | null;
  canCreate: boolean;
  canAssignRole: boolean;
  canChangeStatus: boolean;
};

type CreateMemberForm = {
  fullName: string;
  email: string;
  password: string;
  roleCode: ClinicMemberRoleCode;
};

const INITIAL_FORM: CreateMemberForm = {
  fullName: "",
  email: "",
  password: "",
  roleCode: "receptionist",
};

function getResponseMessage(
  body: unknown,
  fallback: string,
) {
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

function buildRoleDrafts(members: ClinicMember[]) {
  return Object.fromEntries(
    members.map((member) => [
      member.id,
      member.role.code,
    ]),
  ) as Record<string, ClinicMemberRoleCode>;
}

export function ClinicMembersManager({
  clinicId,
  initialMembers,
  currentMembershipId,
  canCreate,
  canAssignRole,
  canChangeStatus,
}: ClinicMembersManagerProps) {
  const [members, setMembers] = useState(initialMembers);
  const [form, setForm] =
    useState<CreateMemberForm>(INITIAL_FORM);
  const [roleDrafts, setRoleDrafts] = useState(
    () => buildRoleDrafts(initialMembers),
  );
  const [pendingAction, setPendingAction] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

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

  function replaceMember(updatedMember: ClinicMember) {
    setMembers((currentMembers) =>
      currentMembers.map((member) =>
        member.id === updatedMember.id
          ? updatedMember
          : member,
      ),
    );

    setRoleDrafts((currentDrafts) => ({
      ...currentDrafts,
      [updatedMember.id]: updatedMember.role.code,
    }));
  }

  async function handleCreate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const passwordBytes =
      new TextEncoder().encode(form.password).length;

    if (passwordBytes > 72) {
      setErrorMessage(
        "A senha ultrapassa o limite de 72 bytes.",
      );

      return;
    }

    setPendingAction("create");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/members`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify(form),
      });

      if (handleUnauthenticated(response)) {
        return;
      }

      const body = await readResponse(response);

      if (!isSuccessfulResponse(response)) {
        throw new Error(
          getResponseMessage(
            body,
            "Não foi possível cadastrar o usuário.",
          ),
        );
      }

      const membership = getMembership(body);

      if (!membership) {
        throw new Error(
          "O servidor retornou um vínculo inválido.",
        );
      }

      setMembers((currentMembers) => [
        ...currentMembers,
        membership,
      ]);

      setRoleDrafts((currentDrafts) => ({
        ...currentDrafts,
        [membership.id]: membership.role.code,
      }));

      setForm(INITIAL_FORM);
      setSuccessMessage(
        "Usuário cadastrado e vinculado à clínica.",
      );
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
    const roleCode =
      roleDrafts[member.id] ?? member.role.code;

    if (roleCode === member.role.code) {
      return;
    }

    setPendingAction(`role:${member.id}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/members/${encodeURIComponent(
          member.id,
        )}/role`,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          roleCode,
        }),
      });

      if (handleUnauthenticated(response)) {
        return;
      }

      const body = await readResponse(response);

      if (!isSuccessfulResponse(response)) {
        throw new Error(
          getResponseMessage(
            body,
            "Não foi possível alterar o perfil.",
          ),
        );
      }

      const updatedMember = getMembership(body);

      if (!updatedMember) {
        throw new Error(
          "O servidor retornou um vínculo inválido.",
        );
      }

      replaceMember(updatedMember);

      if (member.id === currentMembershipId) {
        window.location.assign("/clinics");

        return;
      }

      setSuccessMessage("Perfil atualizado.");
    } catch (error) {
      setRoleDrafts((currentDrafts) => ({
        ...currentDrafts,
        [member.id]: member.role.code,
      }));

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o perfil.",
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
        )}/members/${encodeURIComponent(
          member.id,
        )}/status`,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          isActive: nextStatus,
        }),
      });

      if (handleUnauthenticated(response)) {
        return;
      }

      const body = await readResponse(response);

      if (!isSuccessfulResponse(response)) {
        throw new Error(
          getResponseMessage(
            body,
            "Não foi possível alterar o status.",
          ),
        );
      }

      const updatedMember = getMembership(body);

      if (!updatedMember) {
        throw new Error(
          "O servidor retornou um vínculo inválido.",
        );
      }

      replaceMember(updatedMember);

      if (member.id === currentMembershipId) {
        window.location.assign("/clinics");

        return;
      }

      setSuccessMessage(
        nextStatus
          ? "Vínculo ativado."
          : "Vínculo inativado.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o status.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  const isBusy = pendingAction !== null;

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium text-muted-foreground">
          Administração
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Usuários e perfis
        </h1>

        <p className="mt-2 text-muted-foreground">
          Cadastre usuários e controle seus vínculos com esta
          clínica.
        </p>

        <div
          aria-live="polite"
          className="mt-6 space-y-3"
        >
          {errorMessage ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div
              role="status"
              className="rounded-lg border bg-background px-4 py-3 text-sm"
            >
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
                onSubmit={handleCreate}
              >
                <div className="space-y-2">
                  <Label htmlFor="member-full-name">
                    Nome completo
                  </Label>

                  <Input
                    id="member-full-name"
                    name="fullName"
                    autoComplete="name"
                    required
                    minLength={3}
                    maxLength={180}
                    value={form.fullName}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        fullName: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="member-email">
                    E-mail
                  </Label>

                  <Input
                    id="member-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={form.email}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="member-password">
                    Senha inicial
                  </Label>

                  <Input
                    id="member-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={72}
                    value={form.password}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        password: event.target.value,
                      }))
                    }
                  />

                  <p className="text-xs text-muted-foreground">
                    Use ao menos 12 caracteres.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="member-role">
                    Perfil
                  </Label>

                  <select
                    id="member-role"
                    name="roleCode"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={form.roleCode}
                    onChange={(event) => {
                      const roleCode = event.target.value;

                      if (isClinicMemberRoleCode(roleCode)) {
                        setForm((currentForm) => ({
                          ...currentForm,
                          roleCode,
                        }));
                      }
                    }}
                  >
                    {CLINIC_MEMBER_ROLES.map((role) => (
                      <option
                        key={role.code}
                        value={role.code}
                      >
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    disabled={isBusy}
                  >
                    {pendingAction === "create"
                      ? "Cadastrando..."
                      : "Cadastrar e vincular"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              Membros da clínica ({members.length})
            </CardTitle>
          </CardHeader>

          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ainda não há usuários vinculados a esta clínica.
              </p>
            ) : (
              <div className="space-y-4">
                {members.map((member) => {
                  const roleDraft =
                    roleDrafts[member.id] ??
                    member.role.code;

                  return (
                    <section
                      key={member.id}
                      className="rounded-lg border p-4"
                    >
                      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(15rem,0.8fr)_auto] lg:items-end">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {member.user.fullName}
                          </p>

                          <p className="mt-1 break-all text-sm text-muted-foreground">
                            {member.user.email}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border px-2.5 py-1">
                              Vínculo:{" "}
                              {member.isActive
                                ? "ativo"
                                : "inativo"}
                            </span>

                            <span className="rounded-full border px-2.5 py-1">
                              Usuário:{" "}
                              {member.user.isActive
                                ? "ativo"
                                : "inativo"}
                            </span>

                            {member.id ===
                            currentMembershipId ? (
                              <span className="rounded-full border px-2.5 py-1">
                                Seu vínculo
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor={`role-${member.id}`}
                          >
                            Perfil
                          </Label>

                          <div className="flex flex-col gap-2 sm:flex-row">
                            <select
                              id={`role-${member.id}`}
                              className="flex h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                              disabled={
                                !canAssignRole || isBusy
                              }
                              value={roleDraft}
                              onChange={(event) => {
                                const roleCode =
                                  event.target.value;

                                if (
                                  isClinicMemberRoleCode(
                                    roleCode,
                                  )
                                ) {
                                  setRoleDrafts(
                                    (currentDrafts) => ({
                                      ...currentDrafts,
                                      [member.id]: roleCode,
                                    }),
                                  );
                                }
                              }}
                            >
                              {CLINIC_MEMBER_ROLES.map(
                                (role) => (
                                  <option
                                    key={role.code}
                                    value={role.code}
                                  >
                                    {role.label}
                                  </option>
                                ),
                              )}
                            </select>

                            {canAssignRole ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={
                                  isBusy ||
                                  roleDraft ===
                                    member.role.code
                                }
                                onClick={() =>
                                  handleRoleUpdate(member)
                                }
                              >
                                {pendingAction ===
                                `role:${member.id}`
                                  ? "Salvando..."
                                  : "Salvar perfil"}
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        {canChangeStatus ? (
                          <Button
                            type="button"
                            variant={
                              member.isActive
                                ? "destructive"
                                : "outline"
                            }
                            disabled={
                              isBusy ||
                              (!member.isActive &&
                                !member.user.isActive)
                            }
                            onClick={() =>
                              handleStatusUpdate(member)
                            }
                          >
                            {pendingAction ===
                            `status:${member.id}`
                              ? "Salvando..."
                              : member.isActive
                                ? "Inativar vínculo"
                                : "Ativar vínculo"}
                          </Button>
                        ) : null}
                      </div>

                      {!member.user.isActive ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          O vínculo não poderá ser ativado
                          enquanto o usuário estiver globalmente
                          inativo.
                        </p>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
