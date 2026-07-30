import "server-only";

import type {
  AppointmentsResponse,
  AppointmentStatus,
} from "@/types/appointment";
import { getSessionToken } from "@/lib/server/auth-session";
import {
  backendApiFetch,
  readBackendResponse,
} from "@/lib/server/backend-api";

export type GetClinicAppointmentsFilters = {
  from: string;
  to: string;
  page?: number;
  perPage?: number;
  status?: AppointmentStatus;
  patientClinicId?: string;
  clinicProfessionalId?: string;
};

export async function getClinicAppointments(
  clinicId: string,
  filters: GetClinicAppointmentsFilters,
): Promise<AppointmentsResponse | null> {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  const searchParams = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    page: String(filters.page ?? 1),
    perPage: String(filters.perPage ?? 20),
  });

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  if (filters.patientClinicId) {
    searchParams.set(
      "patientClinicId",
      filters.patientClinicId,
    );
  }

  if (filters.clinicProfessionalId) {
    searchParams.set(
      "clinicProfessionalId",
      filters.clinicProfessionalId,
    );
  }

  const response = await backendApiFetch(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/appointments?${searchParams.toString()}`,
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
      `Não foi possível carregar os agendamentos: ${response.status}`,
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
      "O backend retornou uma lista de agendamentos inválida",
    );
  }

  return body as AppointmentsResponse;
}