"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RemoteDataTable,
  type RemoteDataTableColumn,
} from "@/components/data-table/remote-data-table";
import { CreateProfessionalCard } from "@/components/professionals/create-professional-card";
import { EditProfessionalLinkCard } from "@/components/professionals/edit-professional-link-card";
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
  AppointmentAcceptanceFilter,
  ClinicProfessionalLink,
  ProfessionalLinkResponse,
  ProfessionalStatusFilter,
  ProfessionalUserOption,
} from "@/types/professional";

type ClinicProfessionalsManagerProps = {
  clinicId: string;
  canCreate: boolean;
  canUpdate: boolean;
  professionalUserOptions: ProfessionalUserOption[];
};

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

function getProfessionalContact(professionalLink: ClinicProfessionalLink) {
  const { professional } = professionalLink;
  return [professional.phone, professional.email].filter(Boolean).join(" · ");
}

export function ClinicProfessionalsManager({
  clinicId,
  canCreate,
  canUpdate,
  professionalUserOptions,
}: ClinicProfessionalsManagerProps) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProfessionalStatusFilter>("all");
  const [appointmentAcceptanceFilter, setAppointmentAcceptanceFilter] =
    useState<AppointmentAcceptanceFilter>("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingProfessional, setEditingProfessional] =
    useState<ClinicProfessionalLink | null>(null);
  const [statusProfessionalId, setStatusProfessionalId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function reloadProfessionals() {
    setRefreshKey((current) => current + 1);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPage(1);
  }

  function handleStatusChange(value: ProfessionalStatusFilter) {
    setStatusFilter(value);
    setPage(1);
  }

  function handleAppointmentAcceptanceChange(value: AppointmentAcceptanceFilter) {
    setAppointmentAcceptanceFilter(value);
    setPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setAppliedSearch("");
    setStatusFilter("all");
    setAppointmentAcceptanceFilter("all");
    setPage(1);
  }

  function handleProfessionalCreated() {
    clearFilters();
    reloadProfessionals();
  }

  function handleProfessionalUpdated() {
    setEditingProfessional(null);
    setErrorMessage(null);
    setSuccessMessage("Configurações do vínculo profissional atualizadas.");
    reloadProfessionals();
  }

  async function handleProfessionalStatusToggle(professionalLink: ClinicProfessionalLink) {
    const professionalId = professionalLink.professional.id;

    setStatusProfessionalId(professionalId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals/${encodeURIComponent(professionalId)}/status`,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ isActive: !professionalLink.isActive }),
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

      const body = (await readBrowserJson(response)) as ProfessionalLinkResponse;

      if (!body.professionalLink) {
        setErrorMessage("O servidor retornou um vínculo inválido");
        return;
      }

      setEditingProfessional(null);
      reloadProfessionals();
      setSuccessMessage(
        body.professionalLink.isActive
          ? "Vínculo profissional ativado."
          : "Vínculo profissional inativado.",
      );
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor");
    } finally {
      setStatusProfessionalId(null);
    }
  }

  const hasFilters =
    appliedSearch.length > 0 ||
    statusFilter !== "all" ||
    appointmentAcceptanceFilter !== "all";
  const columns: RemoteDataTableColumn<ClinicProfessionalLink>[] = [
    {
      id: "professional",
      header: "Profissional",
      cell: ({ professional }) => (
        <div className="min-w-44">
          <p className="font-medium">{professional.fullName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            CRM {professional.crmState} {professional.crmNumber}
          </p>
        </div>
      ),
    },
    {
      id: "specialty",
      header: "Especialidade",
      cell: (professionalLink) => (
        <div className="min-w-36">
          <p>{professionalLink.professional.specialty}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Código: {professionalLink.localCode ?? "Não informado"}
          </p>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contato",
      cell: (professionalLink) => (
        <div className="min-w-44 text-sm">
          <p>{getProfessionalContact(professionalLink) || "Não informado"}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {professionalLink.professional.user?.email ?? "Conta não vinculada"}
          </p>
        </div>
      ),
    },
    {
      id: "service",
      header: "Atendimento",
      cell: (professionalLink) => (
        <div className="min-w-36 text-xs">
          <p>{professionalLink.defaultAppointmentDurationMinutes} minutos</p>
          <p className="mt-1">
            {professionalLink.acceptsAppointments
              ? "Aceita agendamentos"
              : "Não aceita agendamentos"}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (professionalLink) => (
        <div className="space-y-1 text-xs">
          <p>{professionalLink.isActive ? "Vínculo ativo" : "Vínculo inativo"}</p>
          {!professionalLink.professional.isActive ? (
            <p className="text-destructive">Cadastro global inativo</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Ações",
      className: "w-px",
      cell: (professionalLink) =>
        canUpdate ? (
          <div className="flex min-w-40 flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={statusProfessionalId !== null}
              onClick={() => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setEditingProfessional(professionalLink);
              }}
            >
              Editar vínculo
            </Button>
            <Button
              type="button"
              variant={professionalLink.isActive ? "outline" : "default"}
              disabled={statusProfessionalId !== null || editingProfessional !== null}
              onClick={() => void handleProfessionalStatusToggle(professionalLink)}
            >
              {statusProfessionalId === professionalLink.professional.id
                ? "Atualizando..."
                : professionalLink.isActive
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
        <CreateProfessionalCard
          clinicId={clinicId}
          professionalUserOptions={professionalUserOptions}
          onCreated={handleProfessionalCreated}
        />
      ) : null}

      {editingProfessional ? (
        <EditProfessionalLinkCard
          clinicId={clinicId}
          professionalLink={editingProfessional}
          onUpdated={handleProfessionalUpdated}
          onCancel={() => setEditingProfessional(null)}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Pesquisar profissionais</CardTitle>
          <CardDescription>
            Pesquise por nome, CRM, especialidade ou código local.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px_220px_auto]"
            onSubmit={handleSearch}
          >
            <div className="space-y-2">
              <Label htmlFor="professional-search">Pesquisa</Label>
              <Input
                id="professional-search"
                value={searchInput}
                maxLength={180}
                placeholder="Nome, CRM, especialidade ou código"
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professional-status">Status do vínculo</Label>
              <select
                id="professional-status"
                value={statusFilter}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  handleStatusChange(event.target.value as ProfessionalStatusFilter)
                }
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appointment-acceptance">Recebe agendamentos</Label>
              <select
                id="appointment-acceptance"
                value={appointmentAcceptanceFilter}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  handleAppointmentAcceptanceChange(
                    event.target.value as AppointmentAcceptanceFilter,
                  )
                }
              >
                <option value="all">Todos</option>
                <option value="accepts">Aceita agendamentos</option>
                <option value="does-not-accept">Não aceita agendamentos</option>
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
        <h2 className="text-xl font-semibold">Profissionais da clínica</h2>
        <RemoteDataTable
          route={`/api/clinics/${encodeURIComponent(clinicId)}/professionals`}
          columns={columns}
          query={{
            search: appliedSearch || undefined,
            isActive: statusFilter === "all" ? undefined : statusFilter === "active",
            acceptsAppointments:
              appointmentAcceptanceFilter === "all"
                ? undefined
                : appointmentAcceptanceFilter === "accepts",
          }}
          page={page}
          refreshKey={refreshKey}
          getRowId={(professionalLink) => professionalLink.id}
          onPageChange={setPage}
          summary={(meta) =>
            meta.total === 1 ? "1 vínculo encontrado" : `${meta.total} vínculos encontrados`
          }
          emptyTitle="Nenhum profissional encontrado"
          emptyDescription={
            hasFilters
              ? "Revise os termos da pesquisa ou limpe os filtros."
              : "Ainda não existem profissionais vinculados a esta clínica."
          }
        />
      </div>
    </div>
  );
}
