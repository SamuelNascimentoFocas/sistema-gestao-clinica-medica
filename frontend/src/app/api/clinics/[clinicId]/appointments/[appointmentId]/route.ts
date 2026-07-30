import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { parseUpdateAppointmentPayload } from "@/lib/server/appointment-payload";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{
    clinicId: string;
    appointmentId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const { clinicId, appointmentId } =
    await context.params;

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/appointments/${encodeURIComponent(
      appointmentId,
    )}`,
  );
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  const originError =
    rejectUntrustedMutation(request);

  if (originError) {
    return originError;
  }

  const body: unknown = await request
    .json()
    .catch(() => null);

  const parsedPayload =
    parseUpdateAppointmentPayload(body);

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

  const { clinicId, appointmentId } =
    await context.params;

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/appointments/${encodeURIComponent(
      appointmentId,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify(parsedPayload.value),
    },
  );
}