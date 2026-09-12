import "server-only";

import { getSessionToken } from "@/lib/server/auth-session";
import {
  backendApiFetch,
  readBackendResponse,
} from "@/lib/server/backend-api";
import { logServerError } from "@/lib/server/server-logging";

export async function authenticatedBackendJson(
  path: string,
  init: RequestInit = {},
) {
  const token = await getSessionToken();

  if (!token) {
    return Response.json(
      {
        message: "Autenticação necessária",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const headers = new Headers(init.headers);

  headers.set("Authorization", `Bearer ${token}`);

  try {
    const response = await backendApiFetch(path, {
      ...init,
      headers,
    });

    const body = await readBackendResponse(response);

    if (body === null) {
      return new Response(null, {
        status: response.status,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    return Response.json(body, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logServerError("bff.backend_json_request_failed", error);

    return Response.json(
      {
        message: "Não foi possível comunicar com o backend",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
