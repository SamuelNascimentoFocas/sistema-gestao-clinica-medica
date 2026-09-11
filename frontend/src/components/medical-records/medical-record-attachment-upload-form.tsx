"use client";

import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FileIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  MEDICAL_RECORD_ATTACHMENT_MAX_FILES,
  getAttachmentFileMetadata,
  getLocalAttachmentPreviewKind,
  getSafeAttachmentUploadErrorMessage,
  type LocalAttachmentPreviewKind,
  validateAttachmentSelection,
} from "@/lib/medical-records/attachment-files";

type MedicalRecordAttachmentUploadFormProps = {
  clinicId: string;
  patientId: string;
  entryId: string;
  onUploaded?: () => Promise<void>;
};

type SelectedAttachmentFile = Readonly<{
  id: string;
  file: File;
  previewKind: LocalAttachmentPreviewKind | null;
  previewUrl: string | null;
}>;

async function readResponseMessage(
  response: BrowserResponse,
) {
  const body: unknown = await readBrowserJson(response)
    .catch(() => null);

  return (
    getSafeAttachmentUploadErrorMessage(body) ??
    "Não foi possível enviar os anexos"
  );
}

function createSelectedAttachmentFiles(
  files: readonly File[],
): SelectedAttachmentFile[] {
  return files.map((file) => {
    const previewKind =
      getLocalAttachmentPreviewKind(file.type);

    return {
      id: crypto.randomUUID(),
      file,
      previewKind,
      previewUrl: previewKind
        ? URL.createObjectURL(file)
        : null,
    };
  });
}

function revokePreviewUrls(
  files: readonly SelectedAttachmentFile[],
) {
  for (const selectedFile of files) {
    if (selectedFile.previewUrl) {
      URL.revokeObjectURL(selectedFile.previewUrl);
    }
  }
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
    useState<SelectedAttachmentFile[]>([]);

  const [isUploading, setIsUploading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  useEffect(() => {
    return () => {
      revokePreviewUrls(selectedFiles);
    };
  }, [selectedFiles]);

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

    const selectionValidation =
      validateAttachmentSelection(files);

    if (!selectionValidation.ok) {
      rejectSelection(selectionValidation.message);

      return;
    }

    setSelectedFiles(
      createSelectedAttachmentFiles(files),
    );
  }

  function removeSelectedFile(id: string) {
    const remainingFiles = selectedFiles
      .filter((selectedFile) => selectedFile.id !== id)
      .map((selectedFile) => selectedFile.file);

    setSelectedFiles(
      createSelectedAttachmentFiles(remainingFiles),
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const selectionValidation =
      validateAttachmentSelection(
        selectedFiles.map(
          (selectedFile) => selectedFile.file,
        ),
      );

    if (!selectionValidation.ok) {
      setErrorMessage(selectionValidation.message);

      return;
    }

    const formData = new FormData();

    for (const selectedFile of selectedFiles) {
      const file = selectedFile.file;

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
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients/${encodeURIComponent(
          patientId,
        )}/medical-record/entries/${encodeURIComponent(
          entryId,
        )}/attachments`,
        method: "POST",
        data: formData,
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();

        return;
      }

      if (!isSuccessfulResponse(response)) {
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
          disabled={isUploading}
          className="border-input bg-background block w-full rounded-md border px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
          onChange={handleFileSelection}
        />

        <p className="text-xs text-muted-foreground">
          Até {MEDICAL_RECORD_ATTACHMENT_MAX_FILES}{" "}
          arquivos por envio. O limite de tamanho
          configurado é validado pelo servidor.
          Pré-visualização local para JPEG, PNG e PDF.
        </p>

        {selectedFiles.length > 0 ? (
          <ul className="space-y-2">
            {selectedFiles.map((selectedFile) => {
              const metadata =
                getAttachmentFileMetadata(
                  selectedFile.file,
                );

              return (
                <li
                  key={selectedFile.id}
                  className="space-y-3 rounded-md border bg-background p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                      {selectedFile.previewUrl &&
                      selectedFile.previewKind ===
                        "image" ? (
                        <Image
                          src={selectedFile.previewUrl}
                          alt={`Pré-visualização de ${metadata.originalName}`}
                          width={64}
                          height={64}
                          unoptimized
                          className="size-full object-cover"
                        />
                      ) : (
                        <FileIcon
                          className="size-6 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="break-all text-sm font-medium">
                        {metadata.originalName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {metadata.formattedSize}
                        {" · "}
                        {metadata.declaredContentType}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isUploading}
                      aria-label={`Remover ${metadata.originalName}`}
                      onClick={() => {
                        removeSelectedFile(selectedFile.id);
                      }}
                    >
                      <XIcon aria-hidden="true" />
                    </Button>
                  </div>

                  {selectedFile.previewUrl &&
                  selectedFile.previewKind === "pdf" ? (
                    <object
                      data={selectedFile.previewUrl}
                      type="application/pdf"
                      aria-label={`Pré-visualização de ${metadata.originalName}`}
                      className="h-64 w-full rounded-md border bg-muted/40 sm:h-80"
                    >
                      <p className="p-3 text-sm text-muted-foreground">
                        A pré-visualização deste PDF não
                        está disponível neste navegador.
                      </p>
                    </object>
                  ) : null}
                </li>
              );
            })}
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
