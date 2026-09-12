import "server-only";

import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";

type ResponseParser<T> = (value: unknown) => T | null;

function safeMessage(status: number) {
  switch (status) {
    case 400:
    case 422:
      return "Os dados informados são inválidos";
    case 401:
      return "Autenticação necessária";
    case 403:
      return "Você não possui permissão para esta operação";
    case 404:
      return "Recurso não encontrado";
    case 409:
      return "A operação não pode ser concluída no estado atual";
    default:
      return "Não foi possível concluir a operação administrativa";
  }
}

export async function globalAdminBackendJson<T>(
  path: string,
  init: RequestInit,
  parseResponse: ResponseParser<T>,
) {
  const response = await authenticatedBackendJson(path, init);

  if (!response.ok) {
    return Response.json(
      { message: safeMessage(response.status) },
      {
        status: response.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const parsed = parseResponse(await response.json().catch(() => null));
  if (!parsed) {
    return Response.json(
      { message: "O backend retornou uma resposta inválida" },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return Response.json(parsed, {
    status: response.status,
    headers: { "Cache-Control": "no-store" },
  });
}
