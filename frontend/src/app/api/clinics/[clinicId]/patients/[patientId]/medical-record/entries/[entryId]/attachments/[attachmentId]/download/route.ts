import { authenticatedBackendBinary } from "@/lib/server/authenticated-backend-binary";
import { parseMedicalRecordAccessPayload } from "@/lib/server/medical-record-payload";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{
    clinicId: string;
    patientId: string;
    entryId: string;
    attachmentId: string;
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

  const {
    clinicId,
    patientId,
    entryId,
    attachmentId,
  } = await context.params;

  const backendQuery = new URLSearchParams({
    purposeCode: String(
      parsedPayload.value.purposeCode,
    ),
  });

  const purposeNote =
    parsedPayload.value.purposeNote;

  if (
    typeof purposeNote === "string" &&
    purposeNote
  ) {
    backendQuery.set("purposeNote", purposeNote);
  }

  return authenticatedBackendBinary(
    `/api/v1/clinics/${encodeURIComponent(
      clinicId,
    )}/patients/${encodeURIComponent(
      patientId,
    )}/medical-record/entries/${encodeURIComponent(
      entryId,
    )}/attachments/${encodeURIComponent(
      attachmentId,
    )}/download?${backendQuery.toString()}`,
  );
}