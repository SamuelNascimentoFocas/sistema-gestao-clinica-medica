import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { parseProfessionalPayload } from "@/lib/server/professional-payload";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{
    clinicId: string;
    professionalId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const { clinicId, professionalId } =
    await context.params;

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/professionals/${encodeURIComponent(
      professionalId,
    )}`,
  );
}

export async function PATCH(
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

  const parsedPayload = parseProfessionalPayload(
    body,
    "update",
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

  const { clinicId, professionalId } =
    await context.params;

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/professionals/${encodeURIComponent(
      professionalId,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify(parsedPayload.value),
    },
  );
}