"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  MEDICAL_RECORD_ENTRY_TYPE_OPTIONS,
  type MedicalRecordEntryType,
} from "@/types/medical-record";

type MedicalRecordEntryFormProps = {
  clinicId: string;
  patientId: string;
  onCreated: () => Promise<void>;
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

  return "Não foi possível registrar a entrada clínica";
}

export function MedicalRecordEntryForm({
  clinicId,
  patientId,
  onCreated,
}: MedicalRecordEntryFormProps) {
  const router = useRouter();

  const [entryTypeCode, setEntryTypeCode] =
    useState<MedicalRecordEntryType>(
      "consultation",
    );

  const [content, setContent] = useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedContent = content.trim();

    if (!normalizedContent) {
      setErrorMessage(
        "Informe o conteúdo da entrada clínica.",
      );

      return;
    }

    if (normalizedContent.length > 20_000) {
      setErrorMessage(
        "O conteúdo deve possuir no máximo 20.000 caracteres.",
      );

      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients/${encodeURIComponent(
          patientId,
        )}/medical-record/entries`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            appointmentId: null,
            entryTypeCode,
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

      await onCreated();

      setSuccessMessage(
        "Entrada clínica registrada com sucesso.",
      );
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Nova entrada clínica
        </CardTitle>

        <CardDescription>
          Registre uma consulta, evolução ou outra
          informação clínica relevante.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          className="space-y-5"
          onSubmit={handleSubmit}
        >
          <div className="space-y-2">
            <Label htmlFor="medical-record-entry-type">
              Tipo da entrada
            </Label>

            <select
              id="medical-record-entry-type"
              value={entryTypeCode}
              disabled={isSubmitting}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => {
                setEntryTypeCode(
                  event.target
                    .value as MedicalRecordEntryType,
                );
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
            >
              {MEDICAL_RECORD_ENTRY_TYPE_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="medical-record-entry-content">
              Conteúdo clínico
            </Label>

            <textarea
              id="medical-record-entry-content"
              value={content}
              required
              maxLength={20_000}
              disabled={isSubmitting}
              rows={8}
              className="border-input bg-background min-h-40 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Descreva as informações clínicas relevantes."
              onChange={(event) => {
                setContent(event.target.value);
                setErrorMessage(null);
                setSuccessMessage(null);
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
              isSubmitting ||
              !content.trim()
            }
          >
            {isSubmitting
              ? "Registrando..."
              : "Registrar entrada"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}