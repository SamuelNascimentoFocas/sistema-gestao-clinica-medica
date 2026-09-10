import "server-only";

import { parseInvitedUserResponse } from "@/lib/invitations/invitation-contract";
import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";

function safeMessage(status: number) {
  switch (status) {
    case 401:
      return "Autenticação necessária";
    case 403:
      return "Você não possui permissão para esta operação";
    case 404:
      return "Usuário ou vínculo não encontrado";
    case 409:
      return "O convite não pode ser processado no estado atual";
    case 422:
      return "Os dados do convite são inválidos";
    default:
      return "Não foi possível processar o convite";
  }
}

export async function authenticatedInvitationBackendJson(
  path: string,
  init: RequestInit = {},
) {
  const response = await authenticatedBackendJson(path, init);

  if (response.ok) {
    const parsed = parseInvitedUserResponse(
      await response.json().catch(() => null),
    );

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

  return Response.json(
    { message: safeMessage(response.status) },
    {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
