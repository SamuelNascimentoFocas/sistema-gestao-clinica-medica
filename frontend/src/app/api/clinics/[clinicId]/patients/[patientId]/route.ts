import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { parsePatientPayload } from "@/lib/server/patient-payload";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{
    clinicId: string;
    patientId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const { clinicId, patientId } =
    await context.params;

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/patients/${encodeURIComponent(patientId)}`,
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

  const parsedPayload = parsePatientPayload(
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

  const { clinicId, patientId } =
    await context.params;

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/patients/${encodeURIComponent(patientId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(parsedPayload.value),
    },
  );
}