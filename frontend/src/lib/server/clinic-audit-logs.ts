import "server-only";

import type {
  AuditLogAccessAction,
  AuditLogPurposeCode,
  AuditLogsResponse,
} from "@/types/audit-log";
import { getSessionToken } from "@/lib/server/auth-session";
import {
  backendApiFetch,
  readBackendResponse,
} from "@/lib/server/backend-api";

export type GetClinicAuditLogsFilters = {
  page?: number;
  perPage?: number;
  from?: string;
  to?: string;
  userId?: string;
  patientId?: string;
  accessAction?: AuditLogAccessAction;
  purposeCode?: AuditLogPurposeCode;
};

export async function getClinicAuditLogs(
  clinicId: string,
  filters: GetClinicAuditLogsFilters = {},
): Promise<AuditLogsResponse | null> {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  const searchParams = new URLSearchParams({
    page: String(filters.page ?? 1),
    perPage: String(filters.perPage ?? 20),
  });

  if (filters.from) {
    searchParams.set("from", filters.from);
  }

  if (filters.to) {
    searchParams.set("to", filters.to);
  }

  if (filters.userId) {
    searchParams.set("userId", filters.userId);
  }

  if (filters.patientId) {
    searchParams.set("patientId", filters.patientId);
  }

  if (filters.accessAction) {
    searchParams.set(
      "accessAction",
      filters.accessAction,
    );
  }

  if (filters.purposeCode) {
    searchParams.set(
      "purposeCode",
      filters.purposeCode,
    );
  }

  const response = await backendApiFetch(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/audit-logs?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if ([401, 403, 404].includes(response.status)) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Não foi possível carregar os registros de auditoria: ${response.status}`,
    );
  }

  const body = await readBackendResponse(response);

  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { data?: unknown }).data) ||
    typeof (body as { meta?: unknown }).meta !==
      "object" ||
    (body as { meta?: unknown }).meta === null
  ) {
    throw new Error(
      "O backend retornou uma lista de auditoria inválida",
    );
  }

  return body as AuditLogsResponse;
}