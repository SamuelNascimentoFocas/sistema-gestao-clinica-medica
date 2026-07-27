import "server-only";

import type { PatientLinksResponse } from "@/types/patient";
import { getSessionToken } from "@/lib/server/auth-session";
import {
  backendApiFetch,
  readBackendResponse,
} from "@/lib/server/backend-api";

export async function getClinicPatients(
  clinicId: string,
): Promise<PatientLinksResponse | null> {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  const response = await backendApiFetch(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/patients?page=1&perPage=20`,
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
      `Não foi possível carregar os pacientes: ${response.status}`,
    );
  }

  const body = await readBackendResponse(response);

  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { data?: unknown }).data) ||
    typeof (body as { meta?: unknown }).meta !== "object" ||
    (body as { meta?: unknown }).meta === null
  ) {
    throw new Error(
      "O backend retornou uma lista de pacientes inválida",
    );
  }

  return body as PatientLinksResponse;
}