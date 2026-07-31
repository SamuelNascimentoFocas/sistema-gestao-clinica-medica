"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type {
  MedicalRecordAccessValues,
  MedicalRecordAttachment,
} from "@/types/medical-record";

type MedicalRecordAttachmentDownloadButtonProps = {
  clinicId: string;
  patientId: string;
  entryId: string;
  attachment: MedicalRecordAttachment;
  accessValues: MedicalRecordAccessValues;
};

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

  return "Não foi possível baixar o anexo";
}

function getDownloadFileName(
  response: Response,
  fallbackName: string,
) {
  const contentDisposition = response.headers.get(
    "content-disposition",
  );

  if (!contentDisposition) {
    return fallbackName;
  }

  const encodedNameMatch =
    contentDisposition.match(
      /filename\*=UTF-8''([^;]+)/i,
    );

  if (encodedNameMatch?.[1]) {
    try {
      return decodeURIComponent(
        encodedNameMatch[1].trim(),
      );
    } catch {
      return fallbackName;
    }
  }

  const basicNameMatch =
    contentDisposition.match(
      /filename="?([^";]+)"?/i,
    );

  return (
    basicNameMatch?.[1]?.trim() ||
    fallbackName
  );
}

export function MedicalRecordAttachmentDownloadButton({
  clinicId,
  patientId,
  entryId,
  attachment,
  accessValues,
}: MedicalRecordAttachmentDownloadButtonProps) {
  const router = useRouter();

  const [isDownloading, setIsDownloading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  async function handleDownload() {
    setIsDownloading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients/${encodeURIComponent(
          patientId,
        )}/medical-record/entries/${encodeURIComponent(
          entryId,
        )}/attachments/${encodeURIComponent(
          attachment.id,
        )}/download`,
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

      const fileContents = await response.blob();

      const objectUrl =
        URL.createObjectURL(fileContents);

      const downloadLink =
        document.createElement("a");

      downloadLink.href = objectUrl;
      downloadLink.download =
        getDownloadFileName(
          response,
          attachment.originalName,
        );

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 0);
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor.",
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        type="button"
        variant="outline"
        disabled={isDownloading}
        onClick={() => {
          void handleDownload();
        }}
      >
        {isDownloading
          ? "Baixando..."
          : "Baixar"}
      </Button>

      {errorMessage ? (
        <p
          className="max-w-56 text-xs text-destructive"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}