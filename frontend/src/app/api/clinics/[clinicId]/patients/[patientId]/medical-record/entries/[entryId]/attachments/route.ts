import { authenticatedBackendJson } from "@/lib/server/authenticated-backend-json";
import { rejectUntrustedMutation } from "@/lib/server/request-security";

type RouteContext = {
  params: Promise<{
    clinicId: string;
    patientId: string;
    entryId: string;
  }>;
};

const MAX_FILES = 2;
const MAX_FILE_SIZE_IN_BYTES = 10 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const ALLOWED_FILE_NAME_PATTERN =
  /\.(pdf|jpe?g|png)$/i;

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

  if (
    receivedValues.length < 1 ||
    receivedValues.length > MAX_FILES
  ) {
    return invalidUpload(
      "Envie entre 1 e 2 arquivos",
    );
  }

  const files: File[] = [];

  for (const value of receivedValues) {
    if (!(value instanceof File)) {
      return invalidUpload(
        "O formulário contém um arquivo inválido",
      );
    }

    const normalizedName = value.name.trim();

    if (
      !normalizedName ||
      normalizedName.length > 255
    ) {
      return invalidUpload(
        "O nome do arquivo é inválido",
      );
    }

    if (
      !ALLOWED_FILE_NAME_PATTERN.test(
        normalizedName,
      )
    ) {
      return invalidUpload(
        "Somente arquivos PDF, JPG, JPEG ou PNG são permitidos",
      );
    }

    if (
      !ALLOWED_CONTENT_TYPES.has(
        value.type.toLowerCase(),
      )
    ) {
      return invalidUpload(
        "O tipo informado do arquivo não é permitido",
      );
    }

    if (
      value.size < 1 ||
      value.size > MAX_FILE_SIZE_IN_BYTES
    ) {
      return invalidUpload(
        "Cada arquivo deve possuir no máximo 10 MB",
      );
    }

    files.push(value);
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

  return authenticatedBackendJson(
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
  );
}