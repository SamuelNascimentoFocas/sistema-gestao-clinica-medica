import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { rejectUntrustedMutation } from "@/lib/server/request-security";
import { isClinicMemberRoleCode } from "@/types/administration";

type RouteContext = {
  params: Promise<{
    clinicId: string;
  }>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const { clinicId } = await context.params;

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(clinicId)}/members`,
  );
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  const originError = rejectUntrustedMutation(request);

  if (originError) {
    return originError;
  }

  const body: unknown = await request.json().catch(() => null);

  if (!isObject(body)) {
    return Response.json(
      {
        message: "Corpo da requisição inválido",
      },
      {
        status: 400,
      },
    );
  }

  const fullName =
    typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim() : "";
  const password =
    typeof body.password === "string" ? body.password : "";
  const roleCode = body.roleCode;

  if (fullName.length < 3 || fullName.length > 180) {
    return Response.json(
      {
        message: "O nome deve possuir entre 3 e 180 caracteres",
      },
      {
        status: 422,
      },
    );
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return Response.json(
      {
        message: "Informe um e-mail válido",
      },
      {
        status: 422,
      },
    );
  }

  const passwordBytes = new TextEncoder().encode(password).length;

  if (
    password.length < 12 ||
    password.length > 72 ||
    passwordBytes > 72
  ) {
    return Response.json(
      {
        message:
          "A senha deve possuir ao menos 12 caracteres e no máximo 72 bytes",
      },
      {
        status: 422,
      },
    );
  }

  if (!isClinicMemberRoleCode(roleCode)) {
    return Response.json(
      {
        message: "Perfil inválido",
      },
      {
        status: 422,
      },
    );
  }

  const { clinicId } = await context.params;

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(clinicId)}/members`,
    {
      method: "POST",
      body: JSON.stringify({
        fullName,
        email,
        password,
        roleCode,
      }),
    },
  );
}