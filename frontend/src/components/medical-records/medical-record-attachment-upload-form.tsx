"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type MedicalRecordAttachmentUploadFormProps = {
  clinicId: string;
  patientId: string;
  entryId: string;
  onUploaded?: () => Promise<void>;
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

async function readResponseMessage(
  response: Response,
) {
  const body: unknown = await response
    .json()
    .catch(() => null);

  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return "Não foi possível enviar os anexos";
}

export function MedicalRecordAttachmentUploadForm({
  clinicId,
  patientId,
  entryId,
  onUploaded,
}: MedicalRecordAttachmentUploadFormProps) {
  const router = useRouter();

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] =
    useState<File[]>([]);

  const [isUploading, setIsUploading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  function clearSelection() {
    setSelectedFiles([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function rejectSelection(message: string) {
    clearSelection();
    setErrorMessage(message);
    setSuccessMessage(null);
  }

  function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(
      event.target.files ?? [],
    );

    setErrorMessage(null);
    setSuccessMessage(null);

    if (files.length === 0) {
      setSelectedFiles([]);

      return;
    }

    if (files.length > MAX_FILES) {
      rejectSelection(
        "Selecione no máximo 2 arquivos.",
      );

      return;
    }

    for (const file of files) {
      const normalizedName = file.name.trim();

      if (
        !normalizedName ||
        normalizedName.length > 255
      ) {
        rejectSelection(
          "Um dos arquivos possui nome inválido.",
        );

        return;
      }

      if (
        !ALLOWED_FILE_NAME_PATTERN.test(
          normalizedName,
        )
      ) {
        rejectSelection(
          "Somente arquivos PDF, JPG, JPEG ou PNG são permitidos.",
        );

        return;
      }

      if (
        !ALLOWED_CONTENT_TYPES.has(
          file.type.toLowerCase(),
        )
      ) {
        rejectSelection(
          "Um dos arquivos possui tipo não permitido.",
        );

        return;
      }

      if (
        file.size < 1 ||
        file.size > MAX_FILE_SIZE_IN_BYTES
      ) {
        rejectSelection(
          "Cada arquivo deve possuir no máximo 10 MB.",
        );

        return;
      }
    }

    setSelectedFiles(files);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      selectedFiles.length < 1 ||
      selectedFiles.length > MAX_FILES
    ) {
      setErrorMessage(
        "Selecione entre 1 e 2 arquivos.",
      );

      return;
    }

    const formData = new FormData();

    for (const file of selectedFiles) {
      formData.append(
        "files[]",
        file,
        file.name,
      );
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients/${encodeURIComponent(
          patientId,
        )}/medical-record/entries/${encodeURIComponent(
          entryId,
        )}/attachments`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();

        return;
      }

      if (!response.ok) {
        setErrorMessage(
          await readResponseMessage(response),
        );

        return;
      }

      clearSelection();

      if (onUploaded) {
        await onUploaded();
      }

      setSuccessMessage(
        "Anexo enviado com sucesso.",
      );
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form
      className="space-y-4 rounded-md border bg-muted/30 p-4"
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <Label
          htmlFor={`medical-record-attachments-${entryId}`}
        >
          Enviar anexos
        </Label>

        <input
          ref={fileInputRef}
          id={`medical-record-attachments-${entryId}`}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          disabled={isUploading}
          className="border-input bg-background block w-full rounded-md border px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
          onChange={handleFileSelection}
        />

        <p className="text-xs text-muted-foreground">
          Até 2 arquivos por envio, com no máximo
          10 MB cada. Formatos permitidos: PDF, JPG,
          JPEG e PNG.
        </p>

        {selectedFiles.length > 0 ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {selectedFiles.map((file) => (
              <li key={`${file.name}-${file.size}`}>
                {file.name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {errorMessage ? (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p
          className="text-sm text-green-700"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={
          isUploading ||
          selectedFiles.length === 0
        }
      >
        {isUploading
          ? "Enviando..."
          : "Enviar anexos"}
      </Button>
    </form>
  );
}