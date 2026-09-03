"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { scheduleBlockFormSchema } from "@/lib/forms/form-schemas";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfessionalScheduleBlock } from "@/types/professional";
import {
  scheduleBlockToForm,
  type ScheduleBlockFormValues,
  type ScheduleBlockResponse,
} from "@/types/schedule";

type EditScheduleBlockCardProps = {
  clinicId: string;
  professionalId: string;
  scheduleBlock: ProfessionalScheduleBlock;
  onUpdated: (scheduleBlock: ProfessionalScheduleBlock) => void;
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

  return "Não foi possível atualizar o bloqueio";
}

export function EditScheduleBlockCard({
  clinicId,
  professionalId,
  scheduleBlock,
  onUpdated,
  onCancel,
}: EditScheduleBlockCardProps) {
  const router = useRouter();

  const {
    control,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<ScheduleBlockFormValues>({
    resolver: zodResolver(scheduleBlockFormSchema),
    defaultValues: scheduleBlockToForm(scheduleBlock),
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(formValues: ScheduleBlockFormValues) {
    setErrorMessage(null);

    const startsAt = new Date(formValues.startsAt);
    const endsAt = new Date(formValues.endsAt);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals/${encodeURIComponent(
          professionalId,
        )}/schedule-blocks/${encodeURIComponent(scheduleBlock.id)}`,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          reason: formValues.reason,
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

      const body = (await readBrowserJson(response)) as ScheduleBlockResponse;

      onUpdated(body.scheduleBlock);
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor");
    }
  }

  return (
    <div className="rounded-md border p-4">
      <form className="space-y-4" onSubmit={submitForm(handleSubmit)}>
        <div>
          <h3 className="font-medium">Editar bloqueio</h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Altere o período ou o motivo da indisponibilidade.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`edit-block-start-${scheduleBlock.id}`}>
              Início
            </Label>

            <Controller
              control={control}
              name="startsAt"
              render={({ field }) => (
                <Input
                  {...field}
                  aria-invalid={!!errors.startsAt}
                  aria-describedby={
                    errors.startsAt
                      ? `edit-block-start-${scheduleBlock.id}` + "-error"
                      : undefined
                  }
                  id={`edit-block-start-${scheduleBlock.id}`}
                  type="datetime-local"
                  required
                  disabled={isSaving}
                />
              )}
            />
            <FormFieldError
              id={`edit-block-start-${scheduleBlock.id}` + "-error"}
              message={errors.startsAt?.message}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`edit-block-end-${scheduleBlock.id}`}>Fim</Label>

            <Controller
              control={control}
              name="endsAt"
              render={({ field }) => (
                <Input
                  {...field}
                  aria-invalid={!!errors.endsAt}
                  aria-describedby={
                    errors.endsAt
                      ? `edit-block-end-${scheduleBlock.id}` + "-error"
                      : undefined
                  }
                  id={`edit-block-end-${scheduleBlock.id}`}
                  type="datetime-local"
                  required
                  disabled={isSaving}
                />
              )}
            />
            <FormFieldError
              id={`edit-block-end-${scheduleBlock.id}` + "-error"}
              message={errors.endsAt?.message}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`edit-block-reason-${scheduleBlock.id}`}>
              Motivo
            </Label>

            <Controller
              control={control}
              name="reason"
              render={({ field }) => (
                <Input
                  {...field}
                  aria-invalid={!!errors.reason}
                  aria-describedby={
                    errors.reason
                      ? `edit-block-reason-${scheduleBlock.id}` + "-error"
                      : undefined
                  }
                  id={`edit-block-reason-${scheduleBlock.id}`}
                  maxLength={240}
                  disabled={isSaving}
                />
              )}
            />
            <FormFieldError
              id={`edit-block-reason-${scheduleBlock.id}` + "-error"}
              message={errors.reason?.message}
            />
          </div>
        </div>

        {errorMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
