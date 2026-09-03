"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  medicalRecordCorrectionFormSchema,
  type MedicalRecordCorrectionFormValues,
} from "@/lib/forms/form-schemas";
import { FormFieldError } from "@/components/ui/form-field-error";

import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";

import { useState } from "react";
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

async function readResponseMessage(response: BrowserResponse) {
  const body: unknown = await readBrowserJson(response).catch(() => null);

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

  const {
    register,
    resetField,
    control,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting },
  } = useForm<MedicalRecordCorrectionFormValues>({
    resolver: zodResolver(medicalRecordCorrectionFormSchema),
    defaultValues: { content: "" },
  });
  const [content] = useWatch({ control, name: ["content"] });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit({ content }: MedicalRecordCorrectionFormValues) {
    const normalizedContent = content.trim();

    setErrorMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients/${encodeURIComponent(
          patientId,
        )}/medical-record/entries/${encodeURIComponent(entryId)}/corrections`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          content: normalizedContent,
        }),
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();

        return;
      }

      if (!isSuccessfulResponse(response)) {
        setErrorMessage(await readResponseMessage(response));

        return;
      }

      resetField("content", { defaultValue: "" });

      await onCorrected();
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor.");
    }
  }

  return (
    <form
      className="mt-4 space-y-4 rounded-md border bg-muted/30 p-4"
      onSubmit={submitForm(handleSubmit)}
    >
      <div className="space-y-2">
        <Label htmlFor={`medical-record-correction-${entryId}`}>
          Conteúdo da correção
        </Label>

        <textarea
          {...register("content", {
            onChange: () => {
              setErrorMessage(null);
            },
          })}
          aria-invalid={!!errors.content}
          aria-describedby={
            errors.content
              ? `medical-record-correction-${entryId}` + "-error"
              : undefined
          }
          id={`medical-record-correction-${entryId}`}
          required
          maxLength={20_000}
          disabled={isSubmitting}
          rows={6}
          className="border-input bg-background min-h-32 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Registre a informação correta ou complementar. A entrada original permanecerá preservada."
        />
        <FormFieldError
          id={`medical-record-correction-${entryId}` + "-error"}
          message={errors.content?.message}
        />

        <p className="text-xs text-muted-foreground">
          {content.length.toLocaleString("pt-BR")}
          /20.000 caracteres
        </p>
      </div>

      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting || !content.trim()}>
          {isSubmitting ? "Registrando correção..." : "Registrar correção"}
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
