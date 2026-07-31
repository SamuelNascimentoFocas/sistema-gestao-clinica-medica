"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type {
  MedicalRecordAccessValues,
  MedicalRecordAttachmentsResponse,
} from "@/types/medical-record";
import { MedicalRecordAttachmentDownloadButton } from "@/components/medical-records/medical-record-attachment-download-button";
import { MedicalRecordAttachmentUploadForm } from "@/components/medical-records/medical-record-attachment-upload-form";

type MedicalRecordAttachmentsPanelProps = {
  clinicId: string;
  patientId: string;
  entryId: string;
  clinicTimezone: string;
  accessValues: MedicalRecordAccessValues;
  canUploadAttachments: boolean;
};

function formatFileSize(sizeInBytes: number) {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${(
      sizeInBytes / 1024
    ).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} KB`;
  }

  return `${(
    sizeInBytes /
    (1024 * 1024)
  ).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })} MB`;
}

function formatDateTime(
  value: string,
  timezone: string,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

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

  return "Não foi possível consultar os anexos";
}

export function MedicalRecordAttachmentsPanel({
  clinicId,
  patientId,
  entryId,
  clinicTimezone,
  accessValues,
  canUploadAttachments,
}: MedicalRecordAttachmentsPanelProps) {
  const router = useRouter();

  const [
    attachmentsResponse,
    setAttachmentsResponse,
  ] =
    useState<MedicalRecordAttachmentsResponse | null>(
      null,
    );

  const [isLoading, setIsLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  async function loadAttachments(
    page = 1,
    preserveList = false,
  ) {
    setIsLoading(true);
    setErrorMessage(null);

    if (!preserveList) {
      setAttachmentsResponse(null);
    }

    try {
      const response = await fetch(
        `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients/${encodeURIComponent(
          patientId,
        )}/medical-record/entries/${encodeURIComponent(
          entryId,
        )}/attachments/access`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            purposeCode:
              accessValues.purposeCode,
            purposeNote:
              accessValues.purposeNote.trim() ||
              null,
            page,
            perPage: 10,
          }),
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

      const body =
        (await response.json()) as MedicalRecordAttachmentsResponse;

      setAttachmentsResponse(body);
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-4 border-t pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">
            Anexos privados
          </p>

          <p className="text-xs text-muted-foreground">
            A consulta e o download dos arquivos
            ficam registrados para auditoria.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={() => {
            void loadAttachments(1);
          }}
        >
          {isLoading
            ? "Consultando anexos..."
            : attachmentsResponse
              ? "Atualizar anexos"
              : "Consultar anexos"}
        </Button>
      </div>

      {errorMessage ? (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      {attachmentsResponse ? (
        attachmentsResponse.attachments.length ===
        0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Esta entrada clínica não possui anexos
            disponíveis.
          </p>
        ) : (
          <div className="space-y-3">
            {attachmentsResponse.attachments.map(
              (attachment) => (
                <div
                  key={attachment.id}
                  className="flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium">
                      {attachment.originalName}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {attachment.contentType}
                      {" · "}
                      {formatFileSize(
                        attachment.sizeInBytes,
                      )}
                      {" · "}
                      Enviado em{" "}
                      {formatDateTime(
                        attachment.createdAt,
                        clinicTimezone,
                      )}
                    </p>
                  </div>

                  <MedicalRecordAttachmentDownloadButton
                    clinicId={clinicId}
                    patientId={patientId}
                    entryId={entryId}
                    attachment={attachment}
                    accessValues={accessValues}
                  />
                </div>
              ),
            )}
          </div>
        )
      ) : null}

      {attachmentsResponse &&
      attachmentsResponse.meta.lastPage > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={
              isLoading ||
              attachmentsResponse.meta
                .currentPage <= 1
            }
            onClick={() => {
              void loadAttachments(
                attachmentsResponse.meta
                  .currentPage - 1,
                true,
              );
            }}
          >
            Anterior
          </Button>

          <span className="text-sm text-muted-foreground">
            Página{" "}
            {
              attachmentsResponse.meta
                .currentPage
            }{" "}
            de{" "}
            {attachmentsResponse.meta.lastPage}
          </span>

          <Button
            type="button"
            variant="outline"
            disabled={
              isLoading ||
              attachmentsResponse.meta
                .currentPage >=
                attachmentsResponse.meta.lastPage
            }
            onClick={() => {
              void loadAttachments(
                attachmentsResponse.meta
                  .currentPage + 1,
                true,
              );
            }}
          >
            Próxima
          </Button>
        </div>
      ) : null}

      {canUploadAttachments ? (
        <MedicalRecordAttachmentUploadForm
          clinicId={clinicId}
          patientId={patientId}
          entryId={entryId}
          onUploaded={
            attachmentsResponse
              ? () =>
                  loadAttachments(
                    1,
                    true,
                  )
              : undefined
          }
        />
      ) : null}
    </div>
  );
}