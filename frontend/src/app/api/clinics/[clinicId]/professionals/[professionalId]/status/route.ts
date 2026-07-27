import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{
    clinicId: string;
    professionalId: string;
  }>;
};

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

  const isActive =
    typeof body === "object" &&
    body !== null &&
    "isActive" in body
      ? body.isActive
      : null;

  if (typeof isActive !== "boolean") {
    return Response.json(
      {
        message: "O status informado é inválido",
      },
      {
        status: 422,
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
    )}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        isActive,
      }),
    },
  );
}