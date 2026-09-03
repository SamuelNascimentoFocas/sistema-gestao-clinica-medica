"use client";

import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  AppointmentAcceptanceFilter,
  ClinicProfessionalLink,
  ProfessionalLinkResponse,
  ProfessionalLinksResponse,
  ProfessionalStatusFilter,
  ProfessionalUserOption,
} from "@/types/professional";
import { CreateProfessionalCard } from "@/components/professionals/create-professional-card";
import { EditProfessionalLinkCard } from "@/components/professionals/edit-professional-link-card";

type ClinicProfessionalsManagerProps = {
  clinicId: string;
  initialProfessionals: ProfessionalLinksResponse;
  canCreate: boolean;
  canUpdate: boolean;
  doctorOptions: ProfessionalUserOption[];
};

async function readResponseMessage(response: BrowserResponse) {
  const body: unknown = await readBrowserJson(response)
    .catch(() => null);

  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return "Não foi possível concluir a operação";
}

function getProfessionalContact(
  professionalLink: ClinicProfessionalLink,
) {
  const { professional } = professionalLink;

  return [professional.phone, professional.email]
    .filter(Boolean)
    .join(" · ");
}

export function ClinicProfessionalsManager({
  clinicId,
  initialProfessionals,
  canCreate,
  canUpdate,
  doctorOptions,
}: ClinicProfessionalsManagerProps) {
  const router = useRouter();

  const [professionals, setProfessionals] =
    useState<ProfessionalLinksResponse>(
      initialProfessionals,
    );

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<ProfessionalStatusFilter>("all");

  const [
    appointmentAcceptanceFilter,
    setAppointmentAcceptanceFilter,
  ] = useState<AppointmentAcceptanceFilter>("all");

  const [isLoading, setIsLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const [successMessage, setSuccessMessage] = useState<
    string | null
  >(null);

  const [
    editingProfessionalId,
    setEditingProfessionalId,
  ] = useState<string | null>(null);

  const [
    statusProfessionalId,
    setStatusProfessionalId,
  ] = useState<string | null>(null);

  async function loadProfessionals({
    page,
    search,
    status,
    appointmentAcceptance,
  }: {
    page: number;
    search: string;
    status: ProfessionalStatusFilter;
    appointmentAcceptance: AppointmentAcceptanceFilter;
  }) {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const query = new URLSearchParams({
      page: String(page),
      perPage: String(
        professionals.meta.perPage || 20,
      ),
    });

    if (search) {
      query.set("search", search);
    }

    if (status === "active") {
      query.set("isActive", "true");
    }

    if (status === "inactive") {
      query.set("isActive", "false");
    }

    if (appointmentAcceptance === "accepts") {
      query.set("acceptsAppointments", "true");
    }

    if (
      appointmentAcceptance === "does-not-accept"
    ) {
      query.set("acceptsAppointments", "false");
    }

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals?${query.toString()}`,
        method: "GET",
        fetchOptions: { cache: "no-store" },
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();

        return;
      }

      if (!isSuccessfulResponse(response)) {
        setErrorMessage(
          await readResponseMessage(response),
        );

        return;
      }

      const body =
        (await readBrowserJson(response)) as ProfessionalLinksResponse;

      setProfessionals(body);
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedSearch = searchInput.trim();

    setAppliedSearch(normalizedSearch);

    await loadProfessionals({
      page: 1,
      search: normalizedSearch,
      status: statusFilter,
      appointmentAcceptance:
        appointmentAcceptanceFilter,
    });
  }

  async function handleStatusChange(
    value: ProfessionalStatusFilter,
  ) {
    setStatusFilter(value);

    await loadProfessionals({
      page: 1,
      search: appliedSearch,
      status: value,
      appointmentAcceptance:
        appointmentAcceptanceFilter,
    });
  }

  async function handleAppointmentAcceptanceChange(
    value: AppointmentAcceptanceFilter,
  ) {
    setAppointmentAcceptanceFilter(value);

    await loadProfessionals({
      page: 1,
      search: appliedSearch,
      status: statusFilter,
      appointmentAcceptance: value,
    });
  }

  async function clearFilters() {
    setSearchInput("");
    setAppliedSearch("");
    setStatusFilter("all");
    setAppointmentAcceptanceFilter("all");

    await loadProfessionals({
      page: 1,
      search: "",
      status: "all",
      appointmentAcceptance: "all",
    });
  }

  function handleProfessionalCreated(
    professionalLink: ClinicProfessionalLink,
  ) {
    setSearchInput("");
    setAppliedSearch("");
    setStatusFilter("all");
    setAppointmentAcceptanceFilter("all");

    setProfessionals((current) => {
      const perPage = current.meta.perPage || 20;
      const total = current.meta.total + 1;

      return {
        data: [
          professionalLink,
          ...current.data.filter(
            (item) => item.id !== professionalLink.id,
          ),
        ].slice(0, perPage),
        meta: {
          ...current.meta,
          total,
          currentPage: 1,
          lastPage: Math.max(
            1,
            Math.ceil(total / perPage),
          ),
        },
      };
    });
  }

  function handleProfessionalUpdated(
    professionalLink: ClinicProfessionalLink,
  ) {
    setProfessionals((current) => ({
      ...current,
      data: current.data.map((item) =>
        item.id === professionalLink.id
          ? professionalLink
          : item,
      ),
    }));

    setEditingProfessionalId(null);
    setErrorMessage(null);
    setSuccessMessage(
      "Configurações do vínculo profissional atualizadas.",
    );
  }

  async function handleProfessionalStatusToggle(
    professionalLink: ClinicProfessionalLink,
  ) {
    const professionalId =
      professionalLink.professional.id;

    setStatusProfessionalId(professionalId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals/${encodeURIComponent(
          professionalId,
        )}/status`,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          isActive: !professionalLink.isActive,
        }),
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();

        return;
      }

      if (!isSuccessfulResponse(response)) {
        setErrorMessage(
          await readResponseMessage(response),
        );

        return;
      }

      const body =
        (await readBrowserJson(response)) as ProfessionalLinkResponse;

      const updatedProfessionalLink =
        body.professionalLink;

      setProfessionals((current) => {
        const matchesStatusFilter =
          statusFilter === "all" ||
          (statusFilter === "active" &&
            updatedProfessionalLink.isActive) ||
          (statusFilter === "inactive" &&
            !updatedProfessionalLink.isActive);

        const updatedData = current.data.map((item) =>
          item.id === updatedProfessionalLink.id
            ? updatedProfessionalLink
            : item,
        );

        const data = matchesStatusFilter
          ? updatedData
          : updatedData.filter(
              (item) =>
                item.id !==
                updatedProfessionalLink.id,
            );

        const wasVisible = current.data.some(
          (item) =>
            item.id === updatedProfessionalLink.id,
        );

        const removedFromCurrentFilter =
          wasVisible && !matchesStatusFilter;

        const total = removedFromCurrentFilter
          ? Math.max(0, current.meta.total - 1)
          : current.meta.total;

        const perPage = current.meta.perPage || 20;

        const lastPage = Math.max(
          1,
          Math.ceil(total / perPage),
        );

        return {
          data,
          meta: {
            ...current.meta,
            total,
            lastPage,
            currentPage: Math.min(
              current.meta.currentPage,
              lastPage,
            ),
          },
        };
      });

      setEditingProfessionalId(null);

      setSuccessMessage(
        updatedProfessionalLink.isActive
          ? "Vínculo profissional ativado."
          : "Vínculo profissional inativado.",
      );
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor",
      );
    } finally {
      setStatusProfessionalId(null);
    }
  }

  const hasFilters =
    appliedSearch.length > 0 ||
    statusFilter !== "all" ||
    appointmentAcceptanceFilter !== "all";

  return (
    <div className="space-y-6">
      {canCreate ? (
        <CreateProfessionalCard
          clinicId={clinicId}
          doctorOptions={doctorOptions}
          onCreated={handleProfessionalCreated}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Pesquisar profissionais</CardTitle>

          <CardDescription>
            Pesquise por nome, CRM, especialidade ou
            código local.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px_220px_auto]"
            onSubmit={handleSearch}
          >
            <div className="space-y-2">
              <Label htmlFor="professional-search">
                Pesquisa
              </Label>

              <Input
                id="professional-search"
                value={searchInput}
                maxLength={180}
                disabled={isLoading}
                placeholder="Nome, CRM, especialidade ou código"
                onChange={(event) =>
                  setSearchInput(event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professional-status">
                Status do vínculo
              </Label>

              <select
                id="professional-status"
                value={statusFilter}
                disabled={isLoading}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  void handleStatusChange(
                    event.target
                      .value as ProfessionalStatusFilter,
                  )
                }
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appointment-acceptance">
                Recebe agendamentos
              </Label>

              <select
                id="appointment-acceptance"
                value={appointmentAcceptanceFilter}
                disabled={isLoading}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  void handleAppointmentAcceptanceChange(
                    event.target
                      .value as AppointmentAcceptanceFilter,
                  )
                }
              >
                <option value="all">Todos</option>
                <option value="accepts">
                  Aceita agendamentos
                </option>
                <option value="does-not-accept">
                  Não aceita agendamentos
                </option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                type="submit"
                disabled={isLoading}
              >
                {isLoading
                  ? "Carregando..."
                  : "Pesquisar"}
              </Button>

              {hasFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={() =>
                    void clearFilters()
                  }
                >
                  Limpar
                </Button>
              ) : null}
            </div>
          </form>

          {errorMessage ? (
            <p
              className="mt-4 text-sm text-destructive"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p
              className="mt-4 text-sm font-medium text-emerald-700"
              role="status"
            >
              {successMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Profissionais da clínica
          </h2>

          <p className="text-sm text-muted-foreground">
            {professionals.meta.total === 1
              ? "1 vínculo encontrado"
              : `${professionals.meta.total} vínculos encontrados`}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Página {professionals.meta.currentPage} de{" "}
          {Math.max(
            professionals.meta.lastPage,
            1,
          )}
        </p>
      </div>

      {professionals.data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">
              Nenhum profissional encontrado
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters
                ? "Revise os termos da pesquisa ou limpe os filtros."
                : "Ainda não existem profissionais vinculados a esta clínica."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {professionals.data.map(
            (professionalLink) => {
              const { professional } =
                professionalLink;

              const contact =
                getProfessionalContact(
                  professionalLink,
                );

              if (
                editingProfessionalId ===
                professional.id
              ) {
                return (
                  <EditProfessionalLinkCard
                    key={professionalLink.id}
                    clinicId={clinicId}
                    professionalLink={
                      professionalLink
                    }
                    onUpdated={
                      handleProfessionalUpdated
                    }
                    onCancel={() =>
                      setEditingProfessionalId(
                        null,
                      )
                    }
                  />
                );
              }

              return (
                <Card key={professionalLink.id}>
                  <CardHeader className="gap-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="break-words">
                          {professional.fullName}
                        </CardTitle>

                        <CardDescription>
                          CRM {professional.crmState}{" "}
                          {professional.crmNumber}
                        </CardDescription>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={
                            professionalLink.isActive
                              ? "w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
                              : "w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {professionalLink.isActive
                            ? "Vínculo ativo"
                            : "Vínculo inativo"}
                        </span>

                        <span
                          className={
                            professionalLink.acceptsAppointments
                              ? "w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
                              : "w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {professionalLink.acceptsAppointments
                            ? "Aceita agendamentos"
                            : "Não aceita agendamentos"}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">
                          Especialidade
                        </dt>

                        <dd className="font-medium">
                          {professional.specialty}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-muted-foreground">
                          Código local
                        </dt>

                        <dd className="font-medium">
                          {professionalLink.localCode ??
                            "Não informado"}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-muted-foreground">
                          Duração padrão
                        </dt>

                        <dd className="font-medium">
                          {
                            professionalLink.defaultAppointmentDurationMinutes
                          }{" "}
                          minutos
                        </dd>
                      </div>

                      <div>
                        <dt className="text-muted-foreground">
                          Conta de usuário
                        </dt>

                        <dd className="break-words font-medium">
                          {professional.user?.email ??
                            "Não vinculada"}
                        </dd>
                      </div>
                    </dl>

                    {contact ? (
                      <div className="border-t pt-4 text-sm">
                        <p className="text-muted-foreground">
                          Contato
                        </p>

                        <p className="mt-1 break-words">
                          {contact}
                        </p>
                      </div>
                    ) : null}

                    {!professional.isActive ? (
                      <p className="border-t pt-4 text-sm font-medium text-destructive">
                        O cadastro global deste
                        profissional está inativo.
                      </p>
                    ) : null}

                    {canUpdate ? (
                      <div className="flex flex-wrap gap-3 border-t pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            statusProfessionalId !==
                            null
                          }
                          onClick={() => {
                            setErrorMessage(null);
                            setSuccessMessage(null);
                            setEditingProfessionalId(
                              professional.id,
                            );
                          }}
                        >
                          Editar vínculo
                        </Button>

                        <Button
                          type="button"
                          variant={
                            professionalLink.isActive
                              ? "outline"
                              : "default"
                          }
                          disabled={
                            statusProfessionalId !==
                              null ||
                            editingProfessionalId !==
                              null
                          }
                          onClick={() =>
                            void handleProfessionalStatusToggle(
                              professionalLink,
                            )
                          }
                        >
                          {statusProfessionalId ===
                          professional.id
                            ? "Atualizando..."
                            : professionalLink.isActive
                              ? "Inativar vínculo"
                              : "Ativar vínculo"}
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            },
          )}
        </div>
      )}

      {professionals.meta.lastPage > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={
              isLoading ||
              professionals.meta.currentPage <= 1
            }
            onClick={() =>
              void loadProfessionals({
                page:
                  professionals.meta.currentPage -
                  1,
                search: appliedSearch,
                status: statusFilter,
                appointmentAcceptance:
                  appointmentAcceptanceFilter,
              })
            }
          >
            Anterior
          </Button>

          <span className="text-sm text-muted-foreground">
            {professionals.meta.currentPage} de{" "}
            {professionals.meta.lastPage}
          </span>

          <Button
            type="button"
            variant="outline"
            disabled={
              isLoading ||
              professionals.meta.currentPage >=
                professionals.meta.lastPage
            }
            onClick={() =>
              void loadProfessionals({
                page:
                  professionals.meta.currentPage +
                  1,
                search: appliedSearch,
                status: statusFilter,
                appointmentAcceptance:
                  appointmentAcceptanceFilter,
              })
            }
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}
