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
import { logServerError } from "@/lib/server/server-logging";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ClinicContextRouteProps = {
  params: Promise<{
    clinicId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: ClinicContextRouteProps,
) {
  const { clinicId } = await params;

  if (!UUID_PATTERN.test(clinicId)) {
    return NextResponse.json(
      {
        message: "Identificador da clínica inválido",
      },
      {
        status: 400,
      },
    );
  }

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
      `/api/v1/clinics/${clinicId}/context`,
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
          "Não foi possível carregar o contexto da clínica",
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
    logServerError("clinics.context_request_failed", error);

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
