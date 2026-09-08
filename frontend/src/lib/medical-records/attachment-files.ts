export const MEDICAL_RECORD_ATTACHMENT_MAX_FILES = 2;

type AttachmentFileLike = Readonly<{
  name: string;
  size: number;
  type: string;
}>;

type AttachmentSelectionValidation =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; message: string }>;

const LOCAL_IMAGE_PREVIEW_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
]);

export function validateAttachmentSelection(
  files: readonly AttachmentFileLike[],
): AttachmentSelectionValidation {
  if (
    files.length < 1 ||
    files.length > MEDICAL_RECORD_ATTACHMENT_MAX_FILES
  ) {
    return {
      ok: false,
      message: "Envie entre 1 e 2 arquivos.",
    };
  }

  for (const file of files) {
    const normalizedName = file.name.trim();

    if (!normalizedName || normalizedName.length > 255) {
      return {
        ok: false,
        message: "Um dos arquivos possui nome inválido.",
      };
    }

    if (file.size < 1) {
      return {
        ok: false,
        message: "Arquivos vazios não podem ser enviados.",
      };
    }
  }

  return { ok: true };
}

export function isLocalAttachmentPreviewable(contentType: string) {
  return LOCAL_IMAGE_PREVIEW_CONTENT_TYPES.has(
    contentType.trim().toLowerCase(),
  );
}

export function formatAttachmentFileSize(sizeInBytes: number) {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} KB`;
  }

  return `${(sizeInBytes / (1024 * 1024)).toLocaleString(
    "pt-BR",
    {
      maximumFractionDigits: 1,
    },
  )} MB`;
}

export function getAttachmentFileMetadata(
  file: AttachmentFileLike,
) {
  return {
    originalName: file.name,
    sizeInBytes: file.size,
    formattedSize: formatAttachmentFileSize(file.size),
    declaredContentType:
      file.type.trim() || "Tipo não informado",
    previewable: isLocalAttachmentPreviewable(file.type),
  } as const;
}

export function getSafeAttachmentUploadErrorMessage(
  body: unknown,
): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  if ("errors" in body && Array.isArray(body.errors)) {
    for (const error of body.errors) {
      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string" &&
        error.message.trim()
      ) {
        return error.message;
      }
    }
  }

  if (
    "message" in body &&
    typeof body.message === "string" &&
    body.message.trim()
  ) {
    return body.message;
  }

  return null;
}
