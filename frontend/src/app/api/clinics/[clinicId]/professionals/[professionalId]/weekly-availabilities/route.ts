import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { rejectUntrustedMutation } from "@/lib/server/request-security";
import { parseWeeklyAvailabilityPayload } from "@/lib/server/schedule-payload";

type RouteContext = {
  params: Promise<{
    clinicId: string;
    professionalId: string;
  }>;
};

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

  const parsedPayload =
    parseWeeklyAvailabilityPayload(body, "create");

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
    )}/weekly-availabilities`,
    {
      method: "POST",
      body: JSON.stringify(parsedPayload.value),
    },
  );
}