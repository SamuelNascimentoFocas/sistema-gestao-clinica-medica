import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { parseMedicalRecordAccessPayload } from "@/lib/server/medical-record-payload";
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
    parseMedicalRecordAccessPayload(body);

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

  const backendQuery = new URLSearchParams({
    purposeCode: String(
      parsedPayload.value.purposeCode,
    ),
    page: String(parsedPayload.value.page),
    perPage: String(parsedPayload.value.perPage),
  });

  const purposeNote =
    parsedPayload.value.purposeNote;

  if (
    typeof purposeNote === "string" &&
    purposeNote
  ) {
    backendQuery.set("purposeNote", purposeNote);
  }

  return authenticatedBackendJson(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/patients/${encodeURIComponent(
      patientId,
    )}/medical-record/entries/${encodeURIComponent(
      entryId,
    )}/attachments?${backendQuery.toString()}`,
  );
}