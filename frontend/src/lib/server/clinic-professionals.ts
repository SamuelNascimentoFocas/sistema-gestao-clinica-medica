import "server-only";

import type { ProfessionalLinksResponse } from "@/types/professional";
import { getSessionToken } from "@/lib/server/auth-session";
import {
  backendApiFetch,
  readBackendResponse,
} from "@/lib/server/backend-api";

type GetClinicProfessionalsOptions = {
  page?: number;
  perPage?: number;
};

export async function getClinicProfessionals(
  clinicId: string,
  options: GetClinicProfessionalsOptions = {},
): Promise<ProfessionalLinksResponse | null> {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  const page = options.page ?? 1;
  const perPage = options.perPage ?? 20;

  const response = await backendApiFetch(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/professionals?page=${page}&perPage=${perPage}`,
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
      `Não foi possível carregar os profissionais: ${response.status}`,
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
      "O backend retornou uma lista de profissionais inválida",
    );
  }

  return body as ProfessionalLinksResponse;
}