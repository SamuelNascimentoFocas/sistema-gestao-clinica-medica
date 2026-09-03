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
  PatientClinicLink,
  PatientLinkResponse,
  PatientLinksResponse,
  PatientStatusFilter,
} from "@/types/patient";
import { CreatePatientCard } from "@/components/patients/create-patient-card";
import { EditPatientCard } from "@/components/patients/edit-patient-card";

type ClinicPatientsManagerProps = {
  clinicId: string;
  initialPatients: PatientLinksResponse;
  canCreate: boolean;
  canUpdate: boolean;
};

function formatBirthDate(value: string) {
  const dateOnly = value.slice(0, 10);
  const [year, month, day] = dateOnly.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatCpf(value: string | null) {
  if (!value || !/^[0-9]{11}$/.test(value)) {
    return value ?? "Não informado";
  }

  return value.replace(
    /^([0-9]{3})([0-9]{3})([0-9]{3})([0-9]{2})$/,
    "$1.$2.$3-$4",
  );
}

function formatPostalCode(value: string | null) {
  if (!value || !/^[0-9]{8}$/.test(value)) {
    return value ?? "";
  }

  return value.replace(/^([0-9]{5})([0-9]{3})$/, "$1-$2");
}

function getAddress(patientLink: PatientClinicLink) {
  const { patient } = patientLink;

  const firstLine = [
    patient.addressStreet,
    patient.addressNumber,
  ]
    .filter(Boolean)
    .join(", ");

  const secondLine = [
    patient.addressNeighborhood,
    patient.addressCity,
    patient.addressState,
  ]
    .filter(Boolean)
    .join(" - ");

  const postalCode = formatPostalCode(
    patient.addressPostalCode,
  );

  return [firstLine, secondLine, postalCode]
    .filter(Boolean)
    .join(" · ");
}

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

export function ClinicPatientsManager({
  clinicId,
  initialPatients,
  canCreate,
  canUpdate,
}: ClinicPatientsManagerProps) {
  const router = useRouter();

  const [patients, setPatients] =
    useState<PatientLinksResponse>(initialPatients);

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<PatientStatusFilter>("all");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const [successMessage, setSuccessMessage] = useState<
    string | null
  >(null);

  const [statusPatientId, setStatusPatientId] = useState<
    string | null
  >(null);

  const [editingPatientId, setEditingPatientId] =
    useState<string | null>(null);

  async function loadPatients({
    page,
    search,
    status,
  }: {
    page: number;
    search: string;
    status: PatientStatusFilter;
  }) {
    setIsLoading(true);
    setErrorMessage(null);

    const query = new URLSearchParams({
      page: String(page),
      perPage: String(patients.meta.perPage || 20),
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

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients?${query.toString()}`,
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
        (await readBrowserJson(response)) as PatientLinksResponse;

      setPatients(body);
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

    await loadPatients({
      page: 1,
      search: normalizedSearch,
      status: statusFilter,
    });
  }

  async function handleStatusChange(
    value: PatientStatusFilter,
  ) {
    setStatusFilter(value);

    await loadPatients({
      page: 1,
      search: appliedSearch,
      status: value,
    });
  }

  async function clearFilters() {
    setSearchInput("");
    setAppliedSearch("");
    setStatusFilter("all");

    await loadPatients({
      page: 1,
      search: "",
      status: "all",
    });
  }

  async function handlePatientStatusChange(
    patientLink: PatientClinicLink,
  ) {
    const nextIsActive = !patientLink.isActive;

    setStatusPatientId(patientLink.patient.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients/${encodeURIComponent(
          patientLink.patient.id,
        )}/status`,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          isActive: nextIsActive,
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
        (await readBrowserJson(response)) as PatientLinkResponse;

      const updatedPatientLink = body.patientLink;

      setPatients((current) => {
        const remainsInCurrentFilter =
          statusFilter === "all" ||
          (statusFilter === "active" &&
            updatedPatientLink.isActive) ||
          (statusFilter === "inactive" &&
            !updatedPatientLink.isActive);

        if (!remainsInCurrentFilter) {
          const total = Math.max(
            0,
            current.meta.total - 1,
          );

          const perPage = current.meta.perPage || 20;

          return {
            data: current.data.filter(
              (item) =>
                item.id !== updatedPatientLink.id,
            ),
            meta: {
              ...current.meta,
              total,
              lastPage: Math.max(
                1,
                Math.ceil(total / perPage),
              ),
            },
          };
        }

        return {
          ...current,
          data: current.data.map((item) =>
            item.id === updatedPatientLink.id
              ? updatedPatientLink
              : item,
          ),
        };
      });

      setSuccessMessage(
        nextIsActive
          ? "Vínculo do paciente ativado."
          : "Vínculo do paciente inativado.",
      );
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor",
      );
    } finally {
      setStatusPatientId(null);
    }
  }

  const hasFilters =
    appliedSearch.length > 0 || statusFilter !== "all";

  function handlePatientCreated(
    patientLink: PatientClinicLink,
  ) {
    setSearchInput("");
    setAppliedSearch("");
    setStatusFilter("all");

    setPatients((current) => {
      const perPage = current.meta.perPage || 20;
      const total = current.meta.total + 1;

      return {
        data: [
          patientLink,
          ...current.data.filter(
            (item) => item.id !== patientLink.id,
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

  function handlePatientUpdated(
    updatedPatientLink: PatientClinicLink,
  ) {
    setPatients((current) => ({
      ...current,
      data: current.data.map((item) =>
        item.id === updatedPatientLink.id
          ? updatedPatientLink
          : item,
      ),
    }));

    setEditingPatientId(null);
    setErrorMessage(null);
    setSuccessMessage(
      "Dados do paciente atualizados.",
    );
  }

  return (
    <div className="space-y-6">
      {canCreate ? (
        <CreatePatientCard
          clinicId={clinicId}
          onCreated={handlePatientCreated}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Pesquisar pacientes</CardTitle>
          <CardDescription>
            Pesquise por nome, CPF, telefone ou número de
            prontuário local.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto]"
            onSubmit={handleSearch}
          >
            <div className="space-y-2">
              <Label htmlFor="patient-search">
                Pesquisa
              </Label>

              <Input
                id="patient-search"
                value={searchInput}
                maxLength={180}
                disabled={isLoading}
                placeholder="Nome, CPF, telefone ou prontuário"
                onChange={(event) =>
                  setSearchInput(event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-status">
                Status do vínculo
              </Label>

              <select
                id="patient-status"
                value={statusFilter}
                disabled={isLoading}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  void handleStatusChange(
                    event.target
                      .value as PatientStatusFilter,
                  )
                }
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Carregando..." : "Pesquisar"}
              </Button>

              {hasFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => void clearFilters()}
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
            Pacientes da clínica
          </h2>

          <p className="text-sm text-muted-foreground">
            {patients.meta.total === 1
              ? "1 vínculo encontrado"
              : `${patients.meta.total} vínculos encontrados`}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Página {patients.meta.currentPage} de{" "}
          {Math.max(patients.meta.lastPage, 1)}
        </p>
      </div>

      {patients.data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">
              Nenhum paciente encontrado
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters
                ? "Revise os termos da pesquisa ou limpe os filtros."
                : "Ainda não existem pacientes vinculados a esta clínica."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {patients.data.map((patientLink) => {
            const { patient } = patientLink;

            if (editingPatientId === patient.id) {
              return (
                <EditPatientCard
                  key={patientLink.id}
                  clinicId={clinicId}
                  patientLink={patientLink}
                  onUpdated={handlePatientUpdated}
                  onCancel={() =>
                    setEditingPatientId(null)
                  }
                />
              );
            }

            const address = getAddress(patientLink);

            return (
              <Card key={patientLink.id}>
                <CardHeader className="gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="break-words">
                        {patient.fullName}
                      </CardTitle>

                      <CardDescription>
                        Nascimento:{" "}
                        {formatBirthDate(
                          patient.birthDate,
                        )}
                      </CardDescription>
                    </div>

                    <span
                      className={
                        patientLink.isActive
                          ? "w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
                          : "w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {patientLink.isActive
                        ? "Vínculo ativo"
                        : "Vínculo inativo"}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">
                        CPF
                      </dt>
                      <dd className="font-medium">
                        {formatCpf(patient.cpf)}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-muted-foreground">
                        Prontuário local
                      </dt>
                      <dd className="font-medium">
                        {patientLink.localRecordNumber ??
                          "Não informado"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-muted-foreground">
                        Telefone
                      </dt>
                      <dd className="font-medium">
                        {patient.phone ?? "Não informado"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-muted-foreground">
                        E-mail
                      </dt>
                      <dd className="break-words font-medium">
                        {patient.email ?? "Não informado"}
                      </dd>
                    </div>
                  </dl>

                  {address ? (
                    <div className="border-t pt-4 text-sm">
                      <p className="text-muted-foreground">
                        Endereço
                      </p>
                      <p className="mt-1">{address}</p>
                    </div>
                  ) : null}

                  {canUpdate ? (
                    <div className="flex flex-wrap gap-2 border-t pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          isLoading ||
                          statusPatientId !== null ||
                          editingPatientId !== null
                        }
                        onClick={() => {
                          setErrorMessage(null);
                          setSuccessMessage(null);
                          setEditingPatientId(
                            patient.id,
                          );
                        }}
                      >
                        Editar dados
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          isLoading ||
                          statusPatientId !== null ||
                          editingPatientId !== null
                        }
                        onClick={() =>
                          void handlePatientStatusChange(
                            patientLink,
                          )
                        }
                      >
                        {statusPatientId === patient.id
                          ? patientLink.isActive
                            ? "Inativando..."
                            : "Ativando..."
                          : patientLink.isActive
                            ? "Inativar vínculo"
                            : "Ativar vínculo"}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {patients.meta.lastPage > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={
              isLoading ||
              patients.meta.currentPage <= 1
            }
            onClick={() =>
              void loadPatients({
                page: patients.meta.currentPage - 1,
                search: appliedSearch,
                status: statusFilter,
              })
            }
          >
            Anterior
          </Button>

          <span className="text-sm text-muted-foreground">
            {patients.meta.currentPage} de{" "}
            {patients.meta.lastPage}
          </span>

          <Button
            type="button"
            variant="outline"
            disabled={
              isLoading ||
              patients.meta.currentPage >=
                patients.meta.lastPage
            }
            onClick={() =>
              void loadPatients({
                page: patients.meta.currentPage + 1,
                search: appliedSearch,
                status: statusFilter,
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
