import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  getSessionToken,
} from "@/lib/server/auth-session";
import {
  backendApiFetch,
  getBackendError,
  readBackendResponse,
} from "@/lib/server/backend-api";

export async function GET() {
  const token = await getSessionToken();

  if (!token) {
    return NextResponse.json(
      {
        message: "Sessão não autenticada",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const backendResponse = await backendApiFetch(
      "/api/v1/auth/me/clinics",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const backendBody = await readBackendResponse(backendResponse);

    if (!backendResponse.ok) {
      const response = NextResponse.json(
        getBackendError(
          backendBody,
          "Não foi possível carregar as clínicas acessíveis",
        ),
        {
          status: backendResponse.status,
        },
      );

      if (backendResponse.status === 401) {
        clearSessionCookie(response);
      }

      return response;
    }

    return NextResponse.json(backendBody);
  } catch (error) {
    console.error("Falha ao carregar as clínicas acessíveis", error);

    return NextResponse.json(
      {
        message: "Não foi possível conectar ao servidor da clínica",
      },
      {
        status: 503,
      },
    );
  }
}