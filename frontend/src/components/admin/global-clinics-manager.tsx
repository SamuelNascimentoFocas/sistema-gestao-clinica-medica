"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { GlobalClinicFormDialog } from "@/components/admin/global-clinic-form-dialog";
import {
  RemoteDataTable,
  type RemoteDataTableColumn,
} from "@/components/data-table/remote-data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  parseGlobalClinicResponse,
  parseGlobalClinicsResponse,
} from "@/lib/admin/global-admin-contract";
import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";
import type { Clinic } from "@/types/clinic";

type ClinicStatusFilter = "all" | "active" | "inactive";

function responseMessage(value: unknown, fallback: string) {
  return typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message
    : fallback;
}

function compactAddress(clinic: Clinic) {
  const locality = [clinic.addressCity, clinic.addressState]
    .filter(Boolean)
    .join(" — ");
  const street = [clinic.addressStreet, clinic.addressNumber]
    .filter(Boolean)
    .join(", ");

  return [street, locality].filter(Boolean).join(" · ") || "—";
}

export function GlobalClinicsManager() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ClinicStatusFilter>("all");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function reloadClinics() {
    setRefreshKey((current) => current + 1);
  }

  function handleSuccess(message: string) {
    setErrorMessage(null);
    setSuccessMessage(message);
    reloadClinics();
  }

  async function readResponse(response: BrowserResponse) {
    return readBrowserJson(response).catch(() => null) as Promise<unknown>;
  }

  async function handleStatusUpdate(clinic: Clinic) {
    const isActive = !clinic.isActive;
    const action = isActive ? "reativar" : "inativar";
    if (!window.confirm(`Confirma ${action} a clínica ${clinic.name}?`)) return;

    setPendingAction(`status:${clinic.id}`);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await browserApi.request<string>({
        url:
          "/api/admin/clinics/" +
          encodeURIComponent(clinic.id) +
          "/status",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ isActive }),
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }

      const body = await readResponse(response);
      if (!isSuccessfulResponse(response)) {
        throw new Error(
          responseMessage(body, "Não foi possível alterar o status da clínica."),
        );
      }
      if (!parseGlobalClinicResponse(body)) {
        throw new Error("O servidor retornou uma clínica inválida.");
      }

      handleSuccess(isActive ? "Clínica reativada." : "Clínica inativada.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o status da clínica.",
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
  const columns: RemoteDataTableColumn<Clinic>[] = [
    {
      id: "identity",
      header: "Clínica",
      cell: (clinic) => (
        <div className="min-w-44">
          <p className="font-medium">{clinic.name}</p>
          <p className="text-xs text-muted-foreground">
            CNPJ: {clinic.cnpj ?? "não informado"}
          </p>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contato e localização",
      className: "hidden md:table-cell",
      cell: (clinic) => (
        <div className="min-w-52">
          <p>{clinic.phone ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            {compactAddress(clinic)}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      className: "hidden sm:table-cell",
      cell: (clinic) => (
        <span className={clinic.isActive ? "text-foreground" : "text-destructive"}>
          {clinic.isActive ? "Ativa" : "Inativa"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Ações",
      className: "w-px",
      cell: (clinic) => (
        <div className="flex min-w-40 flex-col gap-2">
          {clinic.isActive ? (
            <Button
              variant="outline"
              render={
                <Link
                  href={
                    "/clinics/" +
                    encodeURIComponent(clinic.id) +
                    "/administration"
                  }
                />
              }
            >
              Administrar clínica
            </Button>
          ) : null}
          <GlobalClinicFormDialog
            clinic={clinic}
            disabled={isBusy}
            onSuccess={() => handleSuccess("Clínica atualizada.")}
          />
          <Button
            type="button"
            variant={clinic.isActive ? "destructive" : "outline"}
            disabled={isBusy}
            onClick={() => void handleStatusUpdate(clinic)}
          >
            {pendingAction === `status:${clinic.id}`
              ? "Salvando..."
              : clinic.isActive
                ? "Inativar"
                : "Reativar"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section aria-labelledby="global-clinics-title" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="global-clinics-title" className="text-xl font-semibold">
            Clínicas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre clínicas, mantenha seus dados e controle a habilitação.
          </p>
        </div>
        <GlobalClinicFormDialog
          onSuccess={() => handleSuccess("Clínica cadastrada.")}
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
          <CardTitle>Pesquisar clínicas</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
            onSubmit={applySearch}
          >
            <div className="space-y-2">
              <Label htmlFor="global-clinic-search">Pesquisa</Label>
              <Input
                id="global-clinic-search"
                value={searchInput}
                maxLength={180}
                placeholder="Nome da clínica"
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="global-clinic-status-filter">Status</Label>
              <select
                id="global-clinic-status-filter"
                value={statusFilter}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => {
                  setStatusFilter(event.target.value as ClinicStatusFilter);
                  setPage(1);
                }}
              >
                <option value="all">Todas</option>
                <option value="active">Ativas</option>
                <option value="inactive">Inativas</option>
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
          <CardTitle>Clínicas cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          <RemoteDataTable
            route="/api/admin/clinics"
            columns={columns}
            query={{
              search: appliedSearch || undefined,
              isActive:
                statusFilter === "all" ? undefined : statusFilter === "active",
            }}
            page={page}
            refreshKey={refreshKey}
            parseResponse={parseGlobalClinicsResponse}
            getRowId={(clinic) => clinic.id}
            onPageChange={setPage}
            summary={(meta) =>
              meta.total === 1
                ? "1 clínica encontrada"
                : `${meta.total} clínicas encontradas`
            }
            emptyTitle="Nenhuma clínica encontrada"
            emptyDescription={
              hasFilters
                ? "Revise a pesquisa ou limpe os filtros."
                : "Ainda não há clínicas cadastradas."
            }
          />
        </CardContent>
      </Card>
    </section>
  );
}
