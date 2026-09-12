"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormFieldError } from "@/components/ui/form-field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseClinicRolesResponse } from "@/lib/administration/role-contract";
import { parseGlobalClinicsResponse } from "@/lib/admin/global-admin-contract";
import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
} from "@/lib/client/browser-api";
import type { ClinicRole } from "@/types/administration";
import type { Clinic } from "@/types/clinic";
import type { PaginationMeta } from "@/types/pagination";

type GlobalUserMembershipRowProps = {
  index: number;
  clinicId: string;
  roleId: string;
  selectedClinicIds: readonly string[];
  disabled: boolean;
  clinicError?: string;
  roleError?: string;
  onClinicChange: (clinicId: string) => void;
  onRoleChange: (roleId: string) => void;
  onRemove: () => void;
};

function responseMessage(value: unknown, fallback: string) {
  return typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message
    : fallback;
}

export function GlobalUserMembershipRow({
  index,
  clinicId,
  roleId,
  selectedClinicIds,
  disabled,
  clinicError,
  roleError,
  onClinicChange,
  onRoleChange,
  onRemove,
}: GlobalUserMembershipRowProps) {
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicMeta, setClinicMeta] = useState<PaginationMeta | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [roles, setRoles] = useState<ClinicRole[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    if (clinicId) return;
    const controller = new AbortController();

    async function loadClinics() {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setClinicsLoading(true);
      setRequestError(null);

      const query = new URLSearchParams({
        page: String(page),
        perPage: "10",
        isActive: "true",
      });
      if (appliedSearch) query.set("search", appliedSearch);

      try {
        const response = await browserApi.get(
          "/api/admin/clinics?" + query.toString(),
          { signal: controller.signal },
        );
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        const body = await readBrowserJson(response).catch(() => null);
        if (!isSuccessfulResponse(response)) {
          throw new Error(
            responseMessage(body, "Não foi possível carregar os consultórios."),
          );
        }
        const parsed = parseGlobalClinicsResponse(body);
        if (!parsed) throw new Error("O servidor retornou consultórios inválidos.");
        setClinics(parsed.data);
        setClinicMeta(parsed.meta);
      } catch (error) {
        if (!controller.signal.aborted) {
          setRequestError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os consultórios.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setClinicsLoading(false);
      }
    }

    void loadClinics();
    return () => controller.abort();
  }, [appliedSearch, clinicId, page]);

  useEffect(() => {
    if (!clinicId) {
      return;
    }
    const controller = new AbortController();

    async function loadRoles() {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setRolesLoading(true);
      setRequestError(null);

      try {
        const response = await browserApi.get(
          "/api/clinics/" +
            encodeURIComponent(clinicId) +
            "/roles/assignable",
          { signal: controller.signal },
        );
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        const body = await readBrowserJson(response).catch(() => null);
        if (!isSuccessfulResponse(response)) {
          throw new Error(
            responseMessage(body, "Não foi possível carregar os perfis atribuíveis."),
          );
        }
        const parsed = parseClinicRolesResponse(body);
        if (!parsed) throw new Error("O servidor retornou perfis inválidos.");
        setRoles(parsed);
      } catch (error) {
        if (!controller.signal.aborted) {
          setRequestError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os perfis atribuíveis.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setRolesLoading(false);
      }
    }

    void loadRoles();
    return () => controller.abort();
  }, [clinicId]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPage(1);
  }

  function chooseClinic(nextClinicId: string) {
    const clinic = clinics.find((candidate) => candidate.id === nextClinicId);
    if (!clinic || selectedClinicIds.includes(clinic.id)) return;
    setSelectedClinic(clinic);
    onClinicChange(clinic.id);
    onRoleChange("");
  }

  function changeClinic() {
    setSelectedClinic(null);
    setRoles([]);
    onClinicChange("");
    onRoleChange("");
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Vínculo {index + 1}</p>
        <Button type="button" variant="ghost" disabled={disabled} onClick={onRemove}>
          Remover vínculo
        </Button>
      </div>

      {selectedClinic && clinicId ? (
        <div className="rounded-md bg-muted p-3">
          <p className="text-sm font-medium">{selectedClinic.name}</p>
          <Button
            type="button"
            variant="link"
            className="mt-1 px-0"
            disabled={disabled}
            onClick={changeClinic}
          >
            Trocar consultório
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={applySearch}>
            <Input
              aria-label="Pesquisar consultórios"
              value={searchInput}
              maxLength={180}
              placeholder="Pesquisar consultório"
              disabled={disabled}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Button type="submit" variant="outline" disabled={disabled || clinicsLoading}>
              Pesquisar
            </Button>
          </form>

          <div className="space-y-2">
            <Label htmlFor={`global-membership-clinic-${index}`}>Consultório</Label>
            <select
              id={`global-membership-clinic-${index}`}
              value=""
              disabled={disabled || clinicsLoading || clinics.length === 0}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => chooseClinic(event.target.value)}
            >
              <option value="">
                {clinicsLoading ? "Carregando..." : "Selecione um consultório"}
              </option>
              {clinics.map((clinic) => (
                <option
                  key={clinic.id}
                  value={clinic.id}
                  disabled={selectedClinicIds.includes(clinic.id)}
                >
                  {clinic.name}
                </option>
              ))}
            </select>
            <FormFieldError
              id={`global-membership-clinic-error-${index}`}
              message={clinicError}
            />
          </div>

          {clinicMeta && clinicMeta.lastPage > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Página {clinicMeta.currentPage} de {clinicMeta.lastPage}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled || clinicsLoading || clinicMeta.currentPage <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    disabled || clinicsLoading || clinicMeta.currentPage >= clinicMeta.lastPage
                  }
                  onClick={() => setPage((current) => current + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {clinicId ? (
        <div className="space-y-2">
          <Label htmlFor={`global-membership-role-${index}`}>Perfil de acesso</Label>
          <select
            id={`global-membership-role-${index}`}
            value={roleId}
            disabled={disabled || rolesLoading || roles.length === 0}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => onRoleChange(event.target.value)}
          >
            <option value="">
              {rolesLoading
                ? "Carregando..."
                : roles.length === 0
                  ? "Nenhum perfil atribuível"
                  : "Selecione um perfil"}
            </option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <FormFieldError
            id={`global-membership-role-error-${index}`}
            message={roleError}
          />
        </div>
      ) : null}

      {requestError ? (
        <p role="alert" className="text-sm text-destructive">
          {requestError}
        </p>
      ) : null}
    </div>
  );
}
