import "server-only";

import { getSessionToken } from "@/lib/server/auth-session";
import {
  backendApiFetch,
  readBackendResponse,
} from "@/lib/server/backend-api";
import { logServerError } from "@/lib/server/server-logging";

const FORWARDED_RESPONSE_HEADERS = [
  "Content-Type",
  "Content-Length",
  "Content-Disposition",
  "X-Content-Type-Options",
] as const;

export async function authenticatedBackendBinary(
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
  headers.set("Accept", "*/*");

  try {
    const response = await backendApiFetch(path, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const errorBody =
        await readBackendResponse(response);

      if (errorBody !== null) {
        return Response.json(errorBody, {
          status: response.status,
          headers: {
            "Cache-Control": "no-store",
          },
        });
      }

      return new Response(null, {
        status: response.status,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const responseHeaders = new Headers({
      "Cache-Control": "private, no-store",
    });

    for (
      const headerName
      of FORWARDED_RESPONSE_HEADERS
    ) {
      const headerValue =
        response.headers.get(headerName);

      if (headerValue) {
        responseHeaders.set(
          headerName,
          headerValue,
        );
      }
    }

    const fileContents =
      await response.arrayBuffer();

    return new Response(fileContents, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    logServerError("bff.backend_binary_request_failed", error);

    return Response.json(
      {
        message:
          "Não foi possível comunicar com o backend",
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
