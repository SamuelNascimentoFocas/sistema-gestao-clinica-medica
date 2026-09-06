"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RemoteDataTable,
  type RemoteDataTableColumn,
} from "@/components/data-table/remote-data-table";
import { CreatePatientCard } from "@/components/patients/create-patient-card";
import { EditPatientCard } from "@/components/patients/edit-patient-card";
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
import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";
import type {
  PatientClinicLink,
  PatientLinkResponse,
  PatientStatusFilter,
} from "@/types/patient";

type ClinicPatientsManagerProps = {
  clinicId: string;
  canCreate: boolean;
  canUpdate: boolean;
};

function formatBirthDate(value: string) {
  const dateOnly = value.slice(0, 10);
  const [year, month, day] = dateOnly.split("-");

  return year && month && day ? `${day}/${month}/${year}` : value;
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

async function readResponseMessage(response: BrowserResponse) {
  const body: unknown = await readBrowserJson(response).catch(() => null);

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
  canCreate,
  canUpdate,
}: ClinicPatientsManagerProps) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PatientStatusFilter>("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusPatientId, setStatusPatientId] = useState<string | null>(null);
  const [editingPatient, setEditingPatient] = useState<PatientClinicLink | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function reloadPatients() {
    setRefreshKey((current) => current + 1);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPage(1);
  }

  function handleStatusChange(value: PatientStatusFilter) {
    setStatusFilter(value);
    setPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setAppliedSearch("");
    setStatusFilter("all");
    setPage(1);
  }

  async function handlePatientStatusChange(patientLink: PatientClinicLink) {
    const nextIsActive = !patientLink.isActive;

    setStatusPatientId(patientLink.patient.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients/${encodeURIComponent(patientLink.patient.id)}/status`,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ isActive: nextIsActive }),
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      if (!isSuccessfulResponse(response)) {
        setErrorMessage(await readResponseMessage(response));
        return;
      }

      const body = (await readBrowserJson(response)) as PatientLinkResponse;

      if (!body.patientLink) {
        setErrorMessage("O servidor retornou um vínculo inválido");
        return;
      }

      reloadPatients();
      setSuccessMessage(
        nextIsActive
          ? "Vínculo do paciente ativado."
          : "Vínculo do paciente inativado.",
      );
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor");
    } finally {
      setStatusPatientId(null);
    }
  }

  function handlePatientCreated() {
    clearFilters();
    reloadPatients();
  }

  function handlePatientUpdated() {
    setEditingPatient(null);
    setErrorMessage(null);
    setSuccessMessage("Dados do paciente atualizados.");
    reloadPatients();
  }

  const hasFilters = appliedSearch.length > 0 || statusFilter !== "all";
  const columns: RemoteDataTableColumn<PatientClinicLink>[] = [
    {
      id: "patient",
      header: "Paciente",
      cell: ({ patient }) => (
        <div className="min-w-44">
          <p className="font-medium">{patient.fullName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nascimento: {formatBirthDate(patient.birthDate)}
          </p>
        </div>
      ),
    },
    {
      id: "identification",
      header: "Identificação",
      cell: (patientLink) => (
        <div className="min-w-36 text-sm">
          <p>CPF: {formatCpf(patientLink.patient.cpf)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Prontuário: {patientLink.localRecordNumber ?? "Não informado"}
          </p>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contato",
      cell: ({ patient }) => (
        <div className="min-w-44 text-sm">
          <p>{patient.phone ?? "Telefone não informado"}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {patient.email ?? "E-mail não informado"}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (patientLink) => (
        <span
          className={
            patientLink.isActive
              ? "inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
              : "inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
          }
        >
          {patientLink.isActive ? "Vínculo ativo" : "Vínculo inativo"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Ações",
      className: "w-px",
      cell: (patientLink) =>
        canUpdate ? (
          <div className="flex min-w-40 flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={statusPatientId !== null || editingPatient !== null}
              onClick={() => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setEditingPatient(patientLink);
              }}
            >
              Editar dados
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={statusPatientId !== null || editingPatient !== null}
              onClick={() => void handlePatientStatusChange(patientLink)}
            >
              {statusPatientId === patientLink.patient.id
                ? patientLink.isActive
                  ? "Inativando..."
                  : "Ativando..."
                : patientLink.isActive
                  ? "Inativar vínculo"
                  : "Ativar vínculo"}
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      {canCreate ? (
        <CreatePatientCard clinicId={clinicId} onCreated={handlePatientCreated} />
      ) : null}

      {editingPatient ? (
        <EditPatientCard
          clinicId={clinicId}
          patientLink={editingPatient}
          onUpdated={handlePatientUpdated}
          onCancel={() => setEditingPatient(null)}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Pesquisar pacientes</CardTitle>
          <CardDescription>
            Pesquise por nome, CPF, telefone ou número de prontuário local.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto]"
            onSubmit={handleSearch}
          >
            <div className="space-y-2">
              <Label htmlFor="patient-search">Pesquisa</Label>
              <Input
                id="patient-search"
                value={searchInput}
                maxLength={180}
                placeholder="Nome, CPF, telefone ou prontuário"
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-status">Status do vínculo</Label>
              <select
                id="patient-status"
                value={statusFilter}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  handleStatusChange(event.target.value as PatientStatusFilter)
                }
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

          {errorMessage ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p className="mt-4 text-sm font-medium text-emerald-700" role="status">
              {successMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold">Pacientes da clínica</h2>
        <RemoteDataTable
          route={`/api/clinics/${encodeURIComponent(clinicId)}/patients`}
          columns={columns}
          query={{
            search: appliedSearch || undefined,
            isActive: statusFilter === "all" ? undefined : statusFilter === "active",
          }}
          page={page}
          refreshKey={refreshKey}
          getRowId={(patientLink) => patientLink.id}
          onPageChange={setPage}
          summary={(meta) =>
            meta.total === 1 ? "1 vínculo encontrado" : `${meta.total} vínculos encontrados`
          }
          emptyTitle="Nenhum paciente encontrado"
          emptyDescription={
            hasFilters
              ? "Revise os termos da pesquisa ou limpe os filtros."
              : "Ainda não existem pacientes vinculados a esta clínica."
          }
        />
      </div>
    </div>
  );
}
