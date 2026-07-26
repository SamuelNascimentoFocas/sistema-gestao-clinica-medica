import "server-only";

import type {
  ClinicMember,
  ClinicMembersResponse,
} from "@/types/administration";
import { getSessionToken } from "@/lib/server/auth-session";
import {
  backendApiFetch,
  readBackendResponse,
} from "@/lib/server/backend-api";

export async function getClinicMembers(
  clinicId: string,
): Promise<ClinicMember[] | null> {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  const response = await backendApiFetch(
    `/api/v1/clinics/${encodeURIComponent(clinicId)}/members`,
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
      `Não foi possível carregar os membros da clínica: ${response.status}`,
    );
  }

  const body = await readBackendResponse(response);

  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { data?: unknown }).data)
  ) {
    throw new Error("O backend retornou uma lista de membros inválida");
  }

  return (body as ClinicMembersResponse).data;
}