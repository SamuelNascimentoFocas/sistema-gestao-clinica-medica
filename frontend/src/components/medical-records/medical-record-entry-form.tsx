"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  medicalRecordEntryFormSchema,
  type MedicalRecordEntryFormValues,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MEDICAL_RECORD_ENTRY_TYPE_OPTIONS } from "@/types/medical-record";

type MedicalRecordEntryFormProps = {
  clinicId: string;
  patientId: string;
  onCreated: () => Promise<void>;
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

  return "Não foi possível registrar a entrada clínica";
}

export function MedicalRecordEntryForm({
  clinicId,
  patientId,
  onCreated,
}: MedicalRecordEntryFormProps) {
  const router = useRouter();

  const {
    register,
    resetField,
    control,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting },
  } = useForm<MedicalRecordEntryFormValues>({
    resolver: zodResolver(medicalRecordEntryFormSchema),
    defaultValues: { entryTypeCode: "consultation", content: "" },
  });
  const [content] = useWatch({ control, name: ["content"] });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit({
    entryTypeCode,
    content,
  }: MedicalRecordEntryFormValues) {
    const normalizedContent = content.trim();

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients/${encodeURIComponent(patientId)}/medical-record/entries`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          appointmentId: null,
          entryTypeCode,
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

      await onCreated();

      setSuccessMessage("Entrada clínica registrada com sucesso.");
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova entrada clínica</CardTitle>

        <CardDescription>
          Registre uma consulta, evolução ou outra informação clínica relevante.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-5" onSubmit={submitForm(handleSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="medical-record-entry-type">Tipo da entrada</Label>

            <select
              {...register("entryTypeCode", {
                onChange: () => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                },
              })}
              aria-invalid={!!errors.entryTypeCode}
              aria-describedby={
                errors.entryTypeCode
                  ? "medical-record-entry-type-error"
                  : undefined
              }
              id="medical-record-entry-type"
              disabled={isSubmitting}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {MEDICAL_RECORD_ENTRY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FormFieldError
              id={"medical-record-entry-type-error"}
              message={errors.entryTypeCode?.message}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="medical-record-entry-content">
              Conteúdo clínico
            </Label>

            <textarea
              {...register("content", {
                onChange: () => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                },
              })}
              aria-invalid={!!errors.content}
              aria-describedby={
                errors.content
                  ? "medical-record-entry-content-error"
                  : undefined
              }
              id="medical-record-entry-content"
              required
              maxLength={20_000}
              disabled={isSubmitting}
              rows={8}
              className="border-input bg-background min-h-40 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Descreva as informações clínicas relevantes."
            />
            <FormFieldError
              id={"medical-record-entry-content-error"}
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

          {successMessage ? (
            <p className="text-sm text-green-700" role="status">
              {successMessage}
            </p>
          ) : null}

          <Button type="submit" disabled={isSubmitting || !content.trim()}>
            {isSubmitting ? "Registrando..." : "Registrar entrada"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
