"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  appointmentCancellationFormSchema,
  type AppointmentCancellationFormValues,
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
import type {
  Appointment,
  AppointmentCancellationReason,
  AppointmentResponse,
} from "@/types/appointment";

type ManualCancellationReason = Exclude<
  AppointmentCancellationReason,
  "rescheduled"
>;

type StatusAction = "confirm" | "complete" | "no-show";

type AppointmentStatusActionsProps = {
  clinicId: string;
  appointment: Appointment;
  canChangeStatus: boolean;
  currentTimeIso: string;
  onAppointmentChange: (appointment: Appointment) => void;
};

const CANCELLATION_REASON_OPTIONS: Array<{
  value: ManualCancellationReason;
  label: string;
}> = [
  {
    value: "patient_request",
    label: "Solicitação do paciente",
  },
  {
    value: "professional_unavailable",
    label: "Indisponibilidade do profissional",
  },
  {
    value: "clinic_request",
    label: "Solicitação da clínica",
  },
  {
    value: "duplicate",
    label: "Agendamento duplicado",
  },
  {
    value: "created_by_mistake",
    label: "Criado por engano",
  },
  {
    value: "other",
    label: "Outro motivo",
  },
];

const ACTION_CONFIRMATION: Record<StatusAction, string> = {
  confirm: "Confirma este agendamento?",
  complete: "Confirma que este atendimento foi realizado?",
  "no-show": "Confirma o registro de falta do paciente?",
};

const ACTION_SUCCESS_MESSAGE: Record<StatusAction | "cancel", string> = {
  confirm: "Agendamento confirmado com sucesso.",
  complete: "Atendimento marcado como realizado.",
  "no-show": "Falta registrada com sucesso.",
  cancel: "Agendamento cancelado com sucesso.",
};

async function readResponseMessage(response: BrowserResponse) {
  const body: unknown = await readBrowserJson(response).catch(() => null);

  if (typeof body === "object" && body !== null) {
    const candidate = body as {
      message?: unknown;
      error?: unknown;
    };

    if (typeof candidate.message === "string") {
      return candidate.message;
    }

    if (
      typeof candidate.error === "object" &&
      candidate.error !== null &&
      "message" in candidate.error &&
      typeof candidate.error.message === "string"
    ) {
      return candidate.error.message;
    }
  }

  return "Não foi possível alterar a situação do agendamento";
}

export function AppointmentStatusActions({
  clinicId,
  appointment,
  canChangeStatus,
  currentTimeIso,
  onAppointmentChange,
}: AppointmentStatusActionsProps) {
  const router = useRouter();

  const [pendingAction, setPendingAction] = useState<
    StatusAction | "cancel" | null
  >(null);

  const [isCancellationOpen, setIsCancellationOpen] = useState(false);

  const {
    register,
    resetField,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isCancelling },
  } = useForm<AppointmentCancellationFormValues>({
    resolver: zodResolver(appointmentCancellationFormSchema),
    defaultValues: {
      cancellationReasonCode: "patient_request",
      cancellationNote: "",
    },
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isActive =
    appointment.status === "scheduled" || appointment.status === "confirmed";

  const renderedAt = new Date(currentTimeIso).getTime();

  const startsAt = new Date(appointment.startsAt).getTime();

  const hasStarted = renderedAt >= startsAt;

  const canRegisterNoShow = renderedAt >= startsAt + 15 * 60 * 1000;

  const isBusy = pendingAction !== null || isCancelling;

  async function sendTransition(
    action: StatusAction | "cancel",
    payload: Record<string, unknown>,
  ) {
    setPendingAction(action);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/appointments/${encodeURIComponent(appointment.id)}/${action}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify(payload),
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

      const body = (await readBrowserJson(response)) as AppointmentResponse;

      if (!body.appointment) {
        setErrorMessage("O servidor retornou um agendamento inválido");

        return;
      }

      onAppointmentChange(body.appointment);

      setSuccessMessage(ACTION_SUCCESS_MESSAGE[action]);

      if (action === "cancel") {
        setIsCancellationOpen(false);
        resetField("cancellationReasonCode", {
          defaultValue: "patient_request",
        });
        resetField("cancellationNote", { defaultValue: "" });
      }

      router.refresh();
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor");
    } finally {
      setPendingAction(null);
    }
  }

  function handleStatusAction(action: StatusAction) {
    const confirmed = window.confirm(ACTION_CONFIRMATION[action]);

    if (!confirmed) {
      return;
    }

    void sendTransition(action, {
      expectedVersion: appointment.version,
    });
  }

  async function handleCancellationSubmit({
    cancellationReasonCode,
    cancellationNote,
  }: AppointmentCancellationFormValues) {
    await sendTransition("cancel", {
      expectedVersion: appointment.version,
      cancellationReasonCode,
      cancellationNote,
    });
  }

  if (!canChangeStatus) {
    return null;
  }

  if (!isActive && !successMessage && !errorMessage) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4 border-t pt-4">
      {isActive && !isCancellationOpen ? (
        <div className="flex flex-wrap gap-3">
          {appointment.status === "scheduled" ? (
            <Button
              type="button"
              disabled={isBusy}
              onClick={() => handleStatusAction("confirm")}
            >
              {pendingAction === "confirm" ? "Confirmando..." : "Confirmar"}
            </Button>
          ) : null}

          {hasStarted ? (
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => handleStatusAction("complete")}
            >
              {pendingAction === "complete"
                ? "Registrando..."
                : "Marcar como realizado"}
            </Button>
          ) : null}

          {canRegisterNoShow ? (
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => handleStatusAction("no-show")}
            >
              {pendingAction === "no-show"
                ? "Registrando..."
                : "Registrar falta"}
            </Button>
          ) : null}

          <Button
            type="button"
            variant="destructive"
            disabled={isBusy}
            onClick={() => {
              setErrorMessage(null);
              setSuccessMessage(null);
              setIsCancellationOpen(true);
            }}
          >
            Cancelar agendamento
          </Button>
        </div>
      ) : null}

      {isActive && !hasStarted && !isCancellationOpen ? (
        <p className="text-sm text-muted-foreground">
          As opções de conclusão e falta serão disponibilizadas após o horário
          do atendimento.
        </p>
      ) : null}

      {successMessage ? (
        <p className="text-sm font-medium text-emerald-700" role="status">
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {isCancellationOpen ? (
        <form
          className="space-y-4 rounded-md border p-4"
          onSubmit={submitForm(handleCancellationSubmit)}
        >
          <div>
            <h3 className="font-medium">Cancelar agendamento</h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Informe o motivo do cancelamento.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`cancellation-reason-${appointment.id}`}>
              Motivo
            </Label>

            <select
              {...register("cancellationReasonCode")}
              aria-invalid={!!errors.cancellationReasonCode}
              aria-describedby={
                errors.cancellationReasonCode
                  ? `cancellation-reason-${appointment.id}` + "-error"
                  : undefined
              }
              id={`cancellation-reason-${appointment.id}`}
              required
              disabled={isBusy}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CANCELLATION_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FormFieldError
              id={`cancellation-reason-${appointment.id}` + "-error"}
              message={errors.cancellationReasonCode?.message}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`cancellation-note-${appointment.id}`}>
              Observação
            </Label>

            <textarea
              {...register("cancellationNote")}
              aria-invalid={!!errors.cancellationNote}
              aria-describedby={
                errors.cancellationNote
                  ? `cancellation-note-${appointment.id}` + "-error"
                  : undefined
              }
              id={`cancellation-note-${appointment.id}`}
              maxLength={500}
              disabled={isBusy}
              className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Informação opcional"
            />
            <FormFieldError
              id={`cancellation-note-${appointment.id}` + "-error"}
              message={errors.cancellationNote?.message}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="destructive" disabled={isBusy}>
              {pendingAction === "cancel"
                ? "Cancelando..."
                : "Confirmar cancelamento"}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => {
                setIsCancellationOpen(false);
                setErrorMessage(null);
              }}
            >
              Voltar
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
