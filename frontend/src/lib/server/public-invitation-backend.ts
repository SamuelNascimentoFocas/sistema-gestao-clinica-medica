import "server-only";

import { backendApiFetch, readBackendResponse } from "@/lib/server/backend-api";
import { logServerError } from "@/lib/server/server-logging";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function safeSuccessBody(path: string, body: unknown) {
  if (path.endsWith("/validate")) {
    return typeof body === "object" && body !== null && "valid" in body && body.valid === true
      ? { valid: true }
      : null;
  }

  return typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
    ? { message: body.message }
    : null;
}

export function publicInvitationJson(
  body: Record<string, unknown>,
  status: number,
) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function publicInvitationBackendJson(
  path: string,
  payload: Record<string, string>,
) {
  try {
    const response = await backendApiFetch(path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const body = await readBackendResponse(response);

    if (!response.ok) {
      return publicInvitationJson(
        {
          message:
            response.status === 422
              ? "Convite inválido ou indisponível"
              : "Não foi possível processar o convite",
        },
        response.status,
      );
    }

    const safeBody = safeSuccessBody(path, body);
    if (!safeBody) {
      return publicInvitationJson(
        { message: "O backend retornou uma resposta inválida" },
        502,
      );
    }

    return publicInvitationJson(safeBody, response.status);
  } catch (error) {
    logServerError("bff.public_invitation_request_failed", error);
    return publicInvitationJson(
      { message: "Não foi possível comunicar com o backend" },
      503,
    );
  }
}
