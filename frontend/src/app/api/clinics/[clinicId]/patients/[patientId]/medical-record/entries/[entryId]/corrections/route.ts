import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { parseCorrectMedicalRecordEntryPayload } from "@/lib/server/medical-record-payload";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{
    clinicId: string;
    patientId: string;
    entryId: string;
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
    parseCorrectMedicalRecordEntryPayload(body);

  if (!parsedPayload.ok) {
    return Response.json(
      {
        message: parsedPayload.message,
      },
      {
        status: parsedPayload.status,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const { clinicId, patientId, entryId } =
    await context.params;

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/patients/${encodeURIComponent(
      patientId,
    )}/medical-record/entries/${encodeURIComponent(
      entryId,
    )}/corrections`,
    {
      method: "POST",
      body: JSON.stringify(parsedPayload.value),
    },
  );
}