"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type MedicalRecordCorrectionFormProps = {
  clinicId: string;
  patientId: string;
  entryId: string;
  onCorrected: () => Promise<void>;
  onCancel: () => void;
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

  return "Não foi possível registrar a correção";
}

export function MedicalRecordCorrectionForm({
  clinicId,
  patientId,
  entryId,
  onCorrected,
  onCancel,
}: MedicalRecordCorrectionFormProps) {
  const router = useRouter();

  const [content, setContent] = useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedContent = content.trim();

    if (!normalizedContent) {
      setErrorMessage(
        "Informe o conteúdo da correção.",
      );

      return;
    }

    if (normalizedContent.length > 20_000) {
      setErrorMessage(
        "A correção deve possuir no máximo 20.000 caracteres.",
      );

      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients/${encodeURIComponent(
          patientId,
        )}/medical-record/entries/${encodeURIComponent(
          entryId,
        )}/corrections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: normalizedContent,
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

      setContent("");

      await onCorrected();
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="mt-4 space-y-4 rounded-md border bg-muted/30 p-4"
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <Label
          htmlFor={`medical-record-correction-${entryId}`}
        >
          Conteúdo da correção
        </Label>

        <textarea
          id={`medical-record-correction-${entryId}`}
          value={content}
          required
          maxLength={20_000}
          disabled={isSubmitting}
          rows={6}
          className="border-input bg-background min-h-32 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Registre a informação correta ou complementar. A entrada original permanecerá preservada."
          onChange={(event) => {
            setContent(event.target.value);
            setErrorMessage(null);
          }}
        />

        <p className="text-xs text-muted-foreground">
          {content.length.toLocaleString("pt-BR")}
          /20.000 caracteres
        </p>
      </div>

      {errorMessage ? (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={
            isSubmitting ||
            !content.trim()
          }
        >
          {isSubmitting
            ? "Registrando correção..."
            : "Registrar correção"}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}