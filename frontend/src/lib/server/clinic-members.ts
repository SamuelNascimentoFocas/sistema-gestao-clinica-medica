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

  const members: ClinicMember[] = [];
  let page = 1;

  while (true) {
    const response = await backendApiFetch(
      `/api/v1/clinics/${encodeURIComponent(
        clinicId,
      )}/members?page=${page}&perPage=100`,
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
      !Array.isArray((body as { data?: unknown }).data) ||
      typeof (body as { meta?: unknown }).meta !== "object" ||
      (body as { meta?: unknown }).meta === null
    ) {
      throw new Error("O backend retornou uma lista de membros inválida");
    }

    const result = body as ClinicMembersResponse;
    const { currentPage, lastPage, perPage, total } = result.meta;
    const expectedLastPage = Math.max(1, Math.ceil(total / perPage));

    if (
      !Number.isSafeInteger(currentPage) ||
      currentPage < 1 ||
      currentPage !== page ||
      !Number.isSafeInteger(lastPage) ||
      lastPage < 1 ||
      !Number.isSafeInteger(total) ||
      total < 0 ||
      !Number.isSafeInteger(perPage) ||
      perPage !== 100 ||
      lastPage !== expectedLastPage ||
      result.data.length > perPage
    ) {
      throw new Error("O backend retornou paginação de membros inválida");
    }

    members.push(...result.data);

    if (page === lastPage) {
      break;
    }

    const nextPage = page + 1;

    if (!Number.isSafeInteger(nextPage) || nextPage <= page) {
      throw new Error(
        "O backend interrompeu a progressão da paginação de membros",
      );
    }

    page = nextPage;
  }

  return members;
}
