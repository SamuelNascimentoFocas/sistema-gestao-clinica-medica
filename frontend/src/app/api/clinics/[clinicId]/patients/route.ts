import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { parsePatientPayload } from "@/lib/server/patient-payload";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{
    clinicId: string;
  }>;
};

function parsePositiveInteger(
  value: string | null,
  maximum?: number,
) {
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

export async function GET(
  request: Request,
  context: RouteContext,
) {
  const requestUrl = new URL(request.url);
  const backendQuery = new URLSearchParams();

  const page = parsePositiveInteger(
    requestUrl.searchParams.get("page"),
  );

  const perPage = parsePositiveInteger(
    requestUrl.searchParams.get("perPage"),
    100,
  );

  if (page === undefined || perPage === undefined) {
    return Response.json(
      {
        message: "Paginação inválida",
      },
      {
        status: 400,
      },
    );
  }

  backendQuery.set("page", String(page ?? 1));
  backendQuery.set("perPage", String(perPage ?? 20));

  const search =
    requestUrl.searchParams.get("search")?.trim() ?? "";

  if (search) {
    if (search.length > 180) {
      return Response.json(
        {
          message:
            "A pesquisa ultrapassa o limite permitido",
        },
        {
          status: 422,
        },
      );
    }

    backendQuery.set("search", search);
  }

  const isActive =
    requestUrl.searchParams.get("isActive");

  if (isActive !== null) {
    if (!["true", "false"].includes(isActive)) {
      return Response.json(
        {
          message: "Filtro de status inválido",
        },
        {
          status: 422,
        },
      );
    }

    backendQuery.set("isActive", isActive);
  }

  const { clinicId } = await context.params;

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/patients?${backendQuery.toString()}`,
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

  const body: unknown = await request
    .json()
    .catch(() => null);

  const parsedPayload = parsePatientPayload(
    body,
    "create",
  );

  if (!parsedPayload.ok) {
    return Response.json(
      {
        message: parsedPayload.message,
      },
      {
        status: parsedPayload.status,
      },
    );
  }

  const { clinicId } = await context.params;

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/patients`,
    {
      method: "POST",
      body: JSON.stringify(parsedPayload.value),
    },
  );
}