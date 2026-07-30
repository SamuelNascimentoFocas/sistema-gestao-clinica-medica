import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { parseCreateAppointmentPayload } from "@/lib/server/appointment-payload";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{
    clinicId: string;
  }>;
};

const ALLOWED_QUERY_PARAMETERS = [
  "page",
  "perPage",
  "status",
  "patientClinicId",
  "clinicProfessionalId",
  "from",
  "to",
] as const;

export async function GET(
  request: Request,
  context: RouteContext,
) {
  const { clinicId } = await context.params;

  const requestUrl = new URL(request.url);
  const backendSearchParams = new URLSearchParams();

  for (const parameter of ALLOWED_QUERY_PARAMETERS) {
    const value =
      requestUrl.searchParams.get(parameter);

    if (value !== null && value !== "") {
      backendSearchParams.set(parameter, value);
    }
  }

  const query = backendSearchParams.toString();

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/appointments${query ? `?${query}` : ""}`,
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

  const parsedPayload =
    parseCreateAppointmentPayload(body);

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
    )}/appointments`,
    {
      method: "POST",
      body: JSON.stringify(parsedPayload.value),
    },
  );
}