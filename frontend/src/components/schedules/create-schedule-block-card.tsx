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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfessionalScheduleBlock } from "@/types/professional";
import {
  EMPTY_SCHEDULE_BLOCK_FORM,
  type ScheduleBlockFormValues,
  type ScheduleBlockResponse,
} from "@/types/schedule";

type CreateScheduleBlockCardProps = {
  clinicId: string;
  professionalId: string;
  onCreated: (scheduleBlock: ProfessionalScheduleBlock) => void;
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

  return "Não foi possível cadastrar o bloqueio";
}

export function CreateScheduleBlockCard({
  clinicId,
  professionalId,
  onCreated,
}: CreateScheduleBlockCardProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);

  const {
    control,
    reset,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<ScheduleBlockFormValues>({
    resolver: zodResolver(scheduleBlockFormSchema),
    defaultValues: {
      ...EMPTY_SCHEDULE_BLOCK_FORM,
    },
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function resetForm() {
    reset({
      ...EMPTY_SCHEDULE_BLOCK_FORM,
    });

    setErrorMessage(null);
  }

  function closeForm() {
    resetForm();
    setIsOpen(false);
  }

  async function handleSubmit(formValues: ScheduleBlockFormValues) {
    setErrorMessage(null);
    setSuccessMessage(null);

    const startsAt = new Date(formValues.startsAt);
    const endsAt = new Date(formValues.endsAt);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals/${encodeURIComponent(professionalId)}/schedule-blocks`,
        method: "POST",
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

      onCreated(body.scheduleBlock);

      resetForm();
      setIsOpen(false);
      setSuccessMessage("Bloqueio de agenda cadastrado.");
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor");
    }
  }

  if (!isOpen) {
    return (
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Configurar bloqueios de agenda</CardTitle>

            <CardDescription>
              Registre períodos excepcionais de indisponibilidade do
              profissional.
            </CardDescription>
          </div>

          <Button
            type="button"
            onClick={() => {
              setSuccessMessage(null);
              setIsOpen(true);
            }}
          >
            Novo bloqueio
          </Button>
        </CardHeader>

        {successMessage ? (
          <CardContent>
            <p className="text-sm font-medium text-emerald-700" role="status">
              {successMessage}
            </p>
          </CardContent>
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo bloqueio</CardTitle>

        <CardDescription>
          Informe o início, o fim e, opcionalmente, o motivo da
          indisponibilidade.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-6" onSubmit={submitForm(handleSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="schedule-block-start">Início</Label>

              <Controller
                control={control}
                name="startsAt"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.startsAt}
                    aria-describedby={
                      errors.startsAt ? "schedule-block-start-error" : undefined
                    }
                    id="schedule-block-start"
                    type="datetime-local"
                    required
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={"schedule-block-start-error"}
                message={errors.startsAt?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-block-end">Fim</Label>

              <Controller
                control={control}
                name="endsAt"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.endsAt}
                    aria-describedby={
                      errors.endsAt ? "schedule-block-end-error" : undefined
                    }
                    id="schedule-block-end"
                    type="datetime-local"
                    required
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={"schedule-block-end-error"}
                message={errors.endsAt?.message}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="schedule-block-reason">Motivo</Label>

              <Controller
                control={control}
                name="reason"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.reason}
                    aria-describedby={
                      errors.reason ? "schedule-block-reason-error" : undefined
                    }
                    id="schedule-block-reason"
                    maxLength={240}
                    disabled={isSaving}
                    placeholder="Ex.: Congresso médico"
                  />
                )}
              />
              <FormFieldError
                id={"schedule-block-reason-error"}
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
              {isSaving ? "Cadastrando..." : "Cadastrar bloqueio"}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={closeForm}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
