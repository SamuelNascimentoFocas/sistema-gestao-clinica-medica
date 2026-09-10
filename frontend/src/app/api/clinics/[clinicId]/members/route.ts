import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { authenticatedInvitationBackendJson } from "@/lib/server/authenticated-invitation-backend";
import { rejectUntrustedMutation } from "@/lib/server/request-security";
import { isUuid, parseRoleIdPayload } from "@/lib/administration/role-contract";

type RouteContext = {
  params: Promise<{
    clinicId: string;
  }>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePositiveInteger(value: string | null, maximum?: number) {
  if (value === null) {
    return null;
  }

  if (!/^[0-9]+$/.test(value)) {
    return undefined;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    (maximum !== undefined && parsed > maximum)
  ) {
    return undefined;
  }

  return parsed;
}

export async function GET(request: Request, context: RouteContext) {
  const { clinicId } = await context.params;
  if (!isUuid(clinicId)) {
    return Response.json({ message: "Clínica inválida" }, { status: 422 });
  }
  const requestUrl = new URL(request.url);
  const backendQuery = new URLSearchParams();

  const page = parsePositiveInteger(requestUrl.searchParams.get("page"));
  const perPage = parsePositiveInteger(
    requestUrl.searchParams.get("perPage"),
    100,
  );

  if (page === undefined || perPage === undefined) {
    return Response.json(
      { message: "Paginação inválida" },
      { status: 400 },
    );
  }

  backendQuery.set("page", String(page ?? 1));
  backendQuery.set("perPage", String(perPage ?? 20));

  const search = requestUrl.searchParams.get("search")?.trim() ?? "";

  if (search) {
    if (search.length > 180) {
      return Response.json(
        { message: "A pesquisa ultrapassa o limite permitido" },
        { status: 422 },
      );
    }

    backendQuery.set("search", search);
  }

  const roleId = requestUrl.searchParams.get("roleId");

  if (roleId !== null) {
    if (!isUuid(roleId)) {
      return Response.json({ message: "Perfil inválido" }, { status: 422 });
    }

    backendQuery.set("roleId", roleId);
  }

  const isActive = requestUrl.searchParams.get("isActive");

  if (isActive !== null) {
    if (!['true', 'false'].includes(isActive)) {
      return Response.json(
        { message: "Filtro de status inválido" },
        { status: 422 },
      );
    }

    backendQuery.set("isActive", isActive);
  }

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/members?${backendQuery.toString()}`,
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
  const roleResult = parseRoleIdPayload(body);

  if ("password" in body || "passwordConfirmation" in body) {
    return Response.json(
      { message: "A senha deve ser definida pelo usuário através do convite" },
      { status: 422 },
    );
  }

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

  if (!roleResult.ok) {
    return Response.json({ message: roleResult.message }, { status: roleResult.status });
  }

  const { clinicId } = await context.params;
  if (!isUuid(clinicId)) {
    return Response.json({ message: "Clínica inválida" }, { status: 422 });
  }

  return authenticatedInvitationBackendJson(
    `/api/v1/clinics/${encodeURIComponent(clinicId)}/members/invitations`,
    {
      method: "POST",
      body: JSON.stringify({
        fullName,
        email,
        roleId: roleResult.value.roleId,
      }),
    },
  );
}
