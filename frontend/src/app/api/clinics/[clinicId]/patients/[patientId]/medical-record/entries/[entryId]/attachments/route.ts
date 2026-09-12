import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { validateAttachmentSelection } from "@/lib/medical-records/attachment-files";
import { sanitizeMedicalRecordBackendResponse } from "@/lib/medical-records/medical-record-response";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{
    clinicId: string;
    patientId: string;
    entryId: string;
  }>;
};

function invalidUpload(message: string) {
  return Response.json(
    {
      message,
    },
    {
      status: 422,
      headers: {
        "Cache-Control": "no-store",
      },
    },
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

  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .startsWith("multipart/form-data")
  ) {
    return Response.json(
      {
        message:
          "O envio deve utilizar multipart/form-data",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const formData = await request
    .formData()
    .catch(() => null);

  if (!formData) {
    return Response.json(
      {
        message: "Formulário de arquivos inválido",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const hasUnexpectedFields = Array.from(
    formData.keys(),
  ).some(
    (field) =>
      field !== "files" && field !== "files[]",
  );

  if (hasUnexpectedFields) {
    return invalidUpload(
      "O formulário contém campos não permitidos",
    );
  }

  const receivedValues = [
    ...formData.getAll("files"),
    ...formData.getAll("files[]"),
  ];

  const files: File[] = [];

  for (const value of receivedValues) {
    if (!(value instanceof File)) {
      return invalidUpload(
        "O formulário contém um arquivo inválido",
      );
    }

    files.push(value);
  }

  const selectionValidation =
    validateAttachmentSelection(files);

  if (!selectionValidation.ok) {
    return invalidUpload(
      selectionValidation.message,
    );
  }

  const backendFormData = new FormData();

  for (const file of files) {
    backendFormData.append(
      "files[]",
      file,
      file.name,
    );
  }

  const { clinicId, patientId, entryId } =
    await context.params;

  return sanitizeMedicalRecordBackendResponse(
    await authenticatedBackendJson(
      `/api/v1/clinics/${encodeURIComponent(
        clinicId,
      )}/patients/${encodeURIComponent(
        patientId,
      )}/medical-record/entries/${encodeURIComponent(
        entryId,
      )}/attachments`,
      {
        method: "POST",
        body: backendFormData,
      },
    ),
  );
}
