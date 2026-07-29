import "server-only";

import type { ProfessionalScheduleResponse } from "@/types/schedule";
import { getSessionToken } from "@/lib/server/auth-session";
import {
  backendApiFetch,
  readBackendResponse,
} from "@/lib/server/backend-api";

export async function getProfessionalSchedule(
  clinicId: string,
  professionalId: string,
): Promise<ProfessionalScheduleResponse | null> {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  const response = await backendApiFetch(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/professionals/${encodeURIComponent(
      professionalId,
    )}/schedule`,
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
      `Não foi possível carregar a agenda profissional: ${response.status}`,
    );
  }

  const body = await readBackendResponse(response);

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { schedule?: unknown }).schedule !== "object" ||
    (body as { schedule?: unknown }).schedule === null
  ) {
    throw new Error("O backend retornou uma agenda profissional inválida");
  }

  return body as ProfessionalScheduleResponse;
}