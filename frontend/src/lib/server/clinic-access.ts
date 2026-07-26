import { cache } from "react";
import type {
  AccessibleClinic,
  AccessibleClinicsResponse,
  ClinicContext,
} from "@/types/clinic";
import { getSessionToken } from "@/lib/server/auth-session";
import {
  backendApiFetch,
  readBackendResponse,
} from "@/lib/server/backend-api";

export async function getAccessibleClinics(): Promise<
  AccessibleClinic[] | null
> {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  const response = await backendApiFetch("/api/v1/auth/me/clinics", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Não foi possível carregar as clínicas acessíveis: ${response.status}`,
    );
  }

  const body = await readBackendResponse(response);

  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { data?: unknown }).data)
  ) {
    throw new Error("O backend retornou uma lista de clínicas inválida");
  }

  return (body as AccessibleClinicsResponse).data;
}

export const getClinicContext = cache(
  async function getClinicContext(
    clinicId: string,
  ): Promise<ClinicContext | null> {
    const token = await getSessionToken();

    if (!token) {
      return null;
    }

    const response = await backendApiFetch(
      `/api/v1/clinics/${encodeURIComponent(clinicId)}/context`,
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
        `Não foi possível carregar o contexto da clínica: ${response.status}`,
      );
    }

    const body = await readBackendResponse(response);

    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as { clinic?: unknown }).clinic !== "object" ||
      typeof (body as { access?: unknown }).access !== "object"
    ) {
      throw new Error("O backend retornou um contexto de clínica inválido");
    }

    return body as ClinicContext;
  },
);