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
import { scheduleBlockFormSchema } from "@/lib/forms/form-schemas";
import type { ProfessionalScheduleBlock } from "@/types/professional";
import {
  EMPTY_SCHEDULE_BLOCK_FORM,
  scheduleBlockToForm,
  type ScheduleBlockFormValues,
  type ScheduleBlockResponse,
} from "@/types/schedule";

type ScheduleBlockFormDialogProps = {
  clinicId: string;
  professionalId: string;
  scheduleBlock?: ProfessionalScheduleBlock;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess: (scheduleBlock: ProfessionalScheduleBlock) => void;
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

function getFormValues(scheduleBlock?: ProfessionalScheduleBlock) {
  return scheduleBlock
    ? scheduleBlockToForm(scheduleBlock)
    : { ...EMPTY_SCHEDULE_BLOCK_FORM };
}

export function ScheduleBlockFormDialog({
  clinicId,
  professionalId,
  scheduleBlock,
  open,
  onOpenChange,
  onSuccess,
  triggerDisabled = false,
}: ScheduleBlockFormDialogProps) {
  const router = useRouter();
  const isEdit = scheduleBlock !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const [requestError, setRequestError] = useState<{
    formIdentity: string;
    message: string;
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const dialogOpen = open ?? internalOpen;
  const formIdentity = scheduleBlock
    ? `${scheduleBlock.id}:${scheduleBlock.updatedAt}`
    : `create:${professionalId}`;
  const errorMessage =
    requestError?.formIdentity === formIdentity
      ? requestError.message
      : null;
  const fieldIds = scheduleBlock
    ? {
        startsAt: `edit-block-start-${scheduleBlock.id}`,
        endsAt: `edit-block-end-${scheduleBlock.id}`,
        reason: `edit-block-reason-${scheduleBlock.id}`,
      }
    : {
        startsAt: "schedule-block-start",
        endsAt: "schedule-block-end",
        reason: "schedule-block-reason",
      };

  const {
    control,
    reset,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<ScheduleBlockFormValues>({
    resolver: zodResolver(scheduleBlockFormSchema),
    defaultValues: getFormValues(scheduleBlock),
  });

  useEffect(() => {
    reset(getFormValues(scheduleBlock));
  }, [professionalId, reset, scheduleBlock]);

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

    reset(getFormValues(scheduleBlock));
    setRequestError(null);

    if (nextOpen && !isEdit) {
      setSuccessMessage(null);
    }

    setDialogOpen(nextOpen);
  }

  function closeAfterSuccess() {
    reset(getFormValues(scheduleBlock));
    setRequestError(null);
    setDialogOpen(false);
  }

  async function handleSubmit(formValues: ScheduleBlockFormValues) {
    setRequestError(null);

    const requestUrl = scheduleBlock
      ? `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals/${encodeURIComponent(
          professionalId,
        )}/schedule-blocks/${encodeURIComponent(scheduleBlock.id)}`
      : `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals/${encodeURIComponent(
          professionalId,
        )}/schedule-blocks`;

    try {
      const response = await browserApi.request<string>({
        url: requestUrl,
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          startsAt: new Date(formValues.startsAt).toISOString(),
          endsAt: new Date(formValues.endsAt).toISOString(),
          reason: formValues.reason,
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
              ? "Não foi possível atualizar o bloqueio"
              : "Não foi possível cadastrar o bloqueio",
          ),
        });

        return;
      }

      const body = (await readBrowserJson(response)) as ScheduleBlockResponse;

      onSuccess(body.scheduleBlock);

      if (!isEdit) {
        setSuccessMessage("Bloqueio de agenda cadastrado.");
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
          Editar bloqueio
        </DialogTrigger>
      ) : (
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Configurar bloqueios de agenda</CardTitle>

              <CardDescription>
                Registre períodos excepcionais de indisponibilidade do
                profissional.
              </CardDescription>
            </div>

            <DialogTrigger className={buttonVariants()}>
              Novo bloqueio
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
            {isEdit ? "Editar bloqueio" : "Novo bloqueio"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Altere o período ou o motivo da indisponibilidade."
              : "Informe o início, o fim e, opcionalmente, o motivo da indisponibilidade."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={submitForm(handleSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={fieldIds.startsAt}>Início</Label>

              <Controller
                control={control}
                name="startsAt"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.startsAt}
                    aria-describedby={
                      errors.startsAt
                        ? `${fieldIds.startsAt}-error`
                        : undefined
                    }
                    id={fieldIds.startsAt}
                    type="datetime-local"
                    required
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={`${fieldIds.startsAt}-error`}
                message={errors.startsAt?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={fieldIds.endsAt}>Fim</Label>

              <Controller
                control={control}
                name="endsAt"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.endsAt}
                    aria-describedby={
                      errors.endsAt ? `${fieldIds.endsAt}-error` : undefined
                    }
                    id={fieldIds.endsAt}
                    type="datetime-local"
                    required
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={`${fieldIds.endsAt}-error`}
                message={errors.endsAt?.message}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor={fieldIds.reason}>Motivo</Label>

              <Controller
                control={control}
                name="reason"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.reason}
                    aria-describedby={
                      errors.reason ? `${fieldIds.reason}-error` : undefined
                    }
                    id={fieldIds.reason}
                    maxLength={240}
                    disabled={isSaving}
                    placeholder={isEdit ? undefined : "Ex.: Congresso médico"}
                  />
                )}
              />
              <FormFieldError
                id={`${fieldIds.reason}-error`}
                message={errors.reason?.message}
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
                  : "Cadastrar bloqueio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
