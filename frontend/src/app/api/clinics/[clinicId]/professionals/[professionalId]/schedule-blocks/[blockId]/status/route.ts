import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { rejectUntrustedMutation } from "@/lib/server/request-security";
import { parseScheduleStatusPayload } from "@/lib/server/schedule-payload";

type RouteContext = {
  params: Promise<{
    clinicId: string;
    professionalId: string;
    blockId: string;
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

  const parsedPayload =
    parseScheduleStatusPayload(body);

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

  const { clinicId, professionalId, blockId } =
    await context.params;

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/professionals/${encodeURIComponent(
      professionalId,
    )}/schedule-blocks/${encodeURIComponent(
      blockId,
    )}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(parsedPayload.value),
    },
  );
}