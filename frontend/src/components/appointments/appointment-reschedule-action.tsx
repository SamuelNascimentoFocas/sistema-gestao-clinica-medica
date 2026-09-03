"use client";

import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatDateTimeLocalInputInTimeZone,
  localDateTimeToUtcIso,
} from "@/lib/appointments/appointment-date";
import type {
  Appointment,
  AppointmentResponse,
} from "@/types/appointment";
import type { ClinicProfessionalLink } from "@/types/professional";

type AppointmentRescheduleActionProps = {
  clinicId: string;
  clinicTimezone: string;
  appointment: Appointment;
  professionals: ClinicProfessionalLink[];
  canReschedule: boolean;
};

type RescheduleFormValues = {
  clinicProfessionalId: string;
  startsAt: string;
  durationMinutes: string;
  cancellationNote: string;
};

function getAppointmentDurationMinutes(
  appointment: Appointment,
) {
  const startsAt = new Date(
    appointment.startsAt,
  ).getTime();

  const endsAt = new Date(
    appointment.endsAt,
  ).getTime();

  const duration = Math.round(
    (endsAt - startsAt) / 60_000,
  );

  if (
    !Number.isInteger(duration) ||
    duration < 5 ||
    duration > 480
  ) {
    return 30;
  }

  return duration;
}

function createFormValues({
  appointment,
  professionals,
  clinicTimezone,
}: {
  appointment: Appointment;
  professionals: ClinicProfessionalLink[];
  clinicTimezone: string;
}): RescheduleFormValues {
  const currentProfessionalIsAvailable =
    professionals.some(
      (professionalLink) =>
        professionalLink.id ===
        appointment.clinicProfessionalId,
    );

  return {
    clinicProfessionalId:
      currentProfessionalIsAvailable
        ? appointment.clinicProfessionalId
        : (professionals[0]?.id ?? ""),
    startsAt:
      formatDateTimeLocalInputInTimeZone(
        appointment.startsAt,
        clinicTimezone,
      ),
    durationMinutes: String(
      getAppointmentDurationMinutes(appointment),
    ),
    cancellationNote: "",
  };
}

async function readResponseMessage(
  response: BrowserResponse,
) {
  const body: unknown = await readBrowserJson(response)
    .catch(() => null);

  if (
    typeof body === "object" &&
    body !== null
  ) {
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

  return "Não foi possível reagendar o atendimento";
}

export function AppointmentRescheduleAction({
  clinicId,
  clinicTimezone,
  appointment,
  professionals,
  canReschedule,
}: AppointmentRescheduleActionProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);

  const [formValues, setFormValues] =
    useState<RescheduleFormValues>(() =>
      createFormValues({
        appointment,
        professionals,
        clinicTimezone,
      }),
    );

  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const isActive =
    appointment.status === "scheduled" ||
    appointment.status === "confirmed";

  function updateField(
    field: keyof RescheduleFormValues,
    value: string,
  ) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openForm() {
    setFormValues(
      createFormValues({
        appointment,
        professionals,
        clinicTimezone,
      }),
    );

    setErrorMessage(null);
    setIsOpen(true);
  }

  function closeForm() {
    setErrorMessage(null);
    setIsOpen(false);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setIsSaving(true);
    setErrorMessage(null);

    const durationMinutes = Number(
      formValues.durationMinutes,
    );

    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 5 ||
      durationMinutes > 480
    ) {
      setErrorMessage(
        "A duração deve estar entre 5 e 480 minutos",
      );

      setIsSaving(false);

      return;
    }

    let startsAt: string;

    try {
      startsAt = localDateTimeToUtcIso(
        formValues.startsAt,
        clinicTimezone,
      );
    } catch {
      setErrorMessage(
        "A nova data e o novo horário são inválidos",
      );

      setIsSaving(false);

      return;
    }

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/appointments/${encodeURIComponent(
          appointment.id,
        )}/reschedule`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          expectedVersion: appointment.version,
          clinicProfessionalId:
            formValues.clinicProfessionalId,
          startsAt,
          durationMinutes,
          cancellationNote:
            formValues.cancellationNote,
        }),
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();

        return;
      }

      if (!isSuccessfulResponse(response)) {
        setErrorMessage(
          await readResponseMessage(response),
        );

        return;
      }

      const body =
        (await readBrowserJson(response)) as AppointmentResponse;

      if (!body.appointment) {
        setErrorMessage(
          "O servidor retornou um agendamento inválido",
        );

        return;
      }

      const newLocalDate =
        formValues.startsAt.slice(0, 10);

      window.alert(
        "Agendamento reagendado com sucesso.",
      );

      window.location.assign(
        `/clinics/${encodeURIComponent(
          clinicId,
        )}/appointments?fromDate=${encodeURIComponent(
          newLocalDate,
        )}&toDate=${encodeURIComponent(
          newLocalDate,
        )}&page=1`,
      );
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!canReschedule || !isActive) {
    return null;
  }

  if (professionals.length === 0) {
    return (
      <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
        Não há profissional disponível para o
        reagendamento.
      </p>
    );
  }

  if (!isOpen) {
    return (
      <div className="mt-4 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={openForm}
        >
          Reagendar
        </Button>
      </div>
    );
  }

  return (
    <form
      className="mt-4 space-y-5 rounded-md border p-4"
      onSubmit={handleSubmit}
    >
      <div>
        <h3 className="font-medium">
          Reagendar atendimento
        </h3>

        <p className="mt-1 text-sm text-muted-foreground">
          O agendamento atual será cancelado e um
          novo registro será criado.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor={`reschedule-professional-${appointment.id}`}
          >
            Profissional
          </Label>

          <select
            id={`reschedule-professional-${appointment.id}`}
            required
            disabled={isSaving}
            value={
              formValues.clinicProfessionalId
            }
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) =>
              updateField(
                "clinicProfessionalId",
                event.target.value,
              )
            }
          >
            {professionals.map(
              (professionalLink) => (
                <option
                  key={professionalLink.id}
                  value={professionalLink.id}
                >
                  {
                    professionalLink.professional
                      .fullName
                  }{" "}
                  — CRM{" "}
                  {
                    professionalLink.professional
                      .crmState
                  }{" "}
                  {
                    professionalLink.professional
                      .crmNumber
                  }
                </option>
              ),
            )}
          </select>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor={`reschedule-start-${appointment.id}`}
          >
            Nova data e horário
          </Label>

          <Input
            id={`reschedule-start-${appointment.id}`}
            type="datetime-local"
            required
            disabled={isSaving}
            value={formValues.startsAt}
            onChange={(event) =>
              updateField(
                "startsAt",
                event.target.value,
              )
            }
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor={`reschedule-duration-${appointment.id}`}
          >
            Duração em minutos
          </Label>

          <Input
            id={`reschedule-duration-${appointment.id}`}
            type="number"
            min={5}
            max={480}
            step={1}
            required
            disabled={isSaving}
            value={formValues.durationMinutes}
            onChange={(event) =>
              updateField(
                "durationMinutes",
                event.target.value,
              )
            }
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor={`reschedule-note-${appointment.id}`}
          >
            Justificativa administrativa
          </Label>

          <textarea
            id={`reschedule-note-${appointment.id}`}
            maxLength={500}
            disabled={isSaving}
            value={formValues.cancellationNote}
            className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Informação opcional"
            onChange={(event) =>
              updateField(
                "cancellationNote",
                event.target.value,
              )
            }
          />
        </div>
      </div>

      {errorMessage ? (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={isSaving}
        >
          {isSaving
            ? "Reagendando..."
            : "Confirmar reagendamento"}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={isSaving}
          onClick={closeForm}
        >
          Voltar
        </Button>
      </div>
    </form>
  );
}
