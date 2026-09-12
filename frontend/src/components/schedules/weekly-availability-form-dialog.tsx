"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormFieldError } from "@/components/ui/form-field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";
import { weeklyAvailabilityFormSchema } from "@/lib/forms/form-schemas";
import type { ProfessionalWeeklyAvailability } from "@/types/professional";
import {
  EMPTY_WEEKLY_AVAILABILITY_FORM,
  WEEKDAYS,
  weeklyAvailabilityToForm,
  type WeeklyAvailabilityFormValues,
  type WeeklyAvailabilityResponse,
} from "@/types/schedule";

type WeeklyAvailabilityFormDialogProps = {
  clinicId: string;
  professionalId: string;
  availability?: ProfessionalWeeklyAvailability;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess: (availability: ProfessionalWeeklyAvailability) => void;
  triggerDisabled?: boolean;
};

async function readResponseMessage(
  response: BrowserResponse,
  fallback: string,
) {
  const body: unknown = await readBrowserJson(response).catch(() => null);

  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return fallback;
}

function getFormValues(availability?: ProfessionalWeeklyAvailability) {
  return availability
    ? weeklyAvailabilityToForm(availability)
    : { ...EMPTY_WEEKLY_AVAILABILITY_FORM };
}

export function WeeklyAvailabilityFormDialog({
  clinicId,
  professionalId,
  availability,
  open,
  onOpenChange,
  onSuccess,
  triggerDisabled = false,
}: WeeklyAvailabilityFormDialogProps) {
  const router = useRouter();
  const isEdit = availability !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const [requestError, setRequestError] = useState<{
    formIdentity: string;
    message: string;
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const dialogOpen = open ?? internalOpen;
  const formIdentity = availability
    ? `${availability.id}:${availability.updatedAt}`
    : `create:${professionalId}`;
  const errorMessage =
    requestError?.formIdentity === formIdentity
      ? requestError.message
      : null;
  const fieldIds = availability
    ? {
        weekday: `edit-availability-weekday-${availability.id}`,
        startTime: `edit-availability-start-${availability.id}`,
        endTime: `edit-availability-end-${availability.id}`,
      }
    : {
        weekday: "availability-weekday",
        startTime: "availability-start-time",
        endTime: "availability-end-time",
      };

  const {
    control,
    register,
    reset,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<WeeklyAvailabilityFormValues>({
    resolver: zodResolver(weeklyAvailabilityFormSchema),
    defaultValues: getFormValues(availability),
  });

  useEffect(() => {
    reset(getFormValues(availability));
  }, [availability, professionalId, reset]);

  function setDialogOpen(nextOpen: boolean) {
    if (open === undefined) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSaving) {
      return;
    }

    reset(getFormValues(availability));
    setRequestError(null);

    if (nextOpen && !isEdit) {
      setSuccessMessage(null);
    }

    setDialogOpen(nextOpen);
  }

  function closeAfterSuccess() {
    reset(getFormValues(availability));
    setRequestError(null);
    setDialogOpen(false);
  }

  async function handleSubmit(formValues: WeeklyAvailabilityFormValues) {
    setRequestError(null);

    const requestUrl = availability
      ? `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals/${encodeURIComponent(
          professionalId,
        )}/weekly-availabilities/${encodeURIComponent(availability.id)}`
      : `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals/${encodeURIComponent(
          professionalId,
        )}/weekly-availabilities`;

    try {
      const response = await browserApi.request<string>({
        url: requestUrl,
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          weekday: Number(formValues.weekday),
          startTime: formValues.startTime,
          endTime: formValues.endTime,
        }),
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();

        return;
      }

      if (!isSuccessfulResponse(response)) {
        setRequestError({
          formIdentity,
          message: await readResponseMessage(
            response,
            isEdit
              ? "Não foi possível atualizar o horário semanal"
              : "Não foi possível cadastrar o horário semanal",
          ),
        });

        return;
      }

      const body = (await readBrowserJson(
        response,
      )) as WeeklyAvailabilityResponse;

      onSuccess(body.availability);

      if (!isEdit) {
        setSuccessMessage("Horário semanal cadastrado.");
      }

      closeAfterSuccess();
    } catch {
      setRequestError({
        formIdentity,
        message: "Não foi possível comunicar com o servidor",
      });
    }
  }

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={handleDialogOpenChange}
      disablePointerDismissal={isSaving}
    >
      {isEdit ? (
        <DialogTrigger
          className={buttonVariants({ variant: "outline" })}
          disabled={triggerDisabled}
        >
          Editar horário
        </DialogTrigger>
      ) : (
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Configurar disponibilidade semanal</CardTitle>

              <CardDescription>
                Adicione períodos recorrentes em que o profissional poderá
                realizar atendimentos.
              </CardDescription>
            </div>

            <DialogTrigger className={buttonVariants()}>
              Novo horário semanal
            </DialogTrigger>
          </CardHeader>

          {successMessage ? (
            <CardContent>
              <p className="text-sm font-medium text-emerald-700" role="status">
                {successMessage}
              </p>
            </CardContent>
          ) : null}
        </Card>
      )}

      <DialogContent showCloseButton={!isSaving}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar horário semanal" : "Novo horário semanal"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Altere o dia ou o período de disponibilidade."
              : "Informe o dia da semana e o período de disponibilidade."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={submitForm(handleSubmit)}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={fieldIds.weekday}>Dia da semana</Label>

              <select
                {...register("weekday")}
                aria-invalid={!!errors.weekday}
                aria-describedby={
                  errors.weekday ? `${fieldIds.weekday}-error` : undefined
                }
                id={fieldIds.weekday}
                disabled={isSaving}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {WEEKDAYS.map((weekday) => (
                  <option key={weekday.value} value={weekday.value}>
                    {weekday.label}
                  </option>
                ))}
              </select>
              <FormFieldError
                id={`${fieldIds.weekday}-error`}
                message={errors.weekday?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={fieldIds.startTime}>Horário inicial</Label>

              <Controller
                control={control}
                name="startTime"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.startTime}
                    aria-describedby={
                      errors.startTime
                        ? `${fieldIds.startTime}-error`
                        : undefined
                    }
                    id={fieldIds.startTime}
                    type="time"
                    required
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={`${fieldIds.startTime}-error`}
                message={errors.startTime?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={fieldIds.endTime}>Horário final</Label>

              <Controller
                control={control}
                name="endTime"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.endTime}
                    aria-describedby={
                      errors.endTime ? `${fieldIds.endTime}-error` : undefined
                    }
                    id={fieldIds.endTime}
                    type="time"
                    required
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={`${fieldIds.endTime}-error`}
                message={errors.endTime?.message}
              />
            </div>
          </div>

          {errorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose
              className={buttonVariants({ variant: "outline" })}
              disabled={isSaving}
            >
              Cancelar
            </DialogClose>

            <Button type="submit" disabled={isSaving}>
              {isEdit
                ? isSaving
                  ? "Salvando..."
                  : "Salvar alterações"
                : isSaving
                  ? "Cadastrando..."
                  : "Cadastrar horário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
