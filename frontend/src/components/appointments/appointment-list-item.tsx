"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAppointmentDateTime } from "@/lib/appointments/appointment-date";
import {
  getAppointmentStatusLabel,
  type Appointment,
  type AppointmentResponse,
  type AppointmentStatus,
} from "@/types/appointment";
import type { PatientClinicLink } from "@/types/patient";
import { AppointmentStatusActions } from "@/components/appointments/appointment-status-actions";
import { AppointmentRescheduleAction } from "@/components/appointments/appointment-reschedule-action";
import type { ClinicProfessionalLink } from "@/types/professional";

type AppointmentListItemProps = {
  clinicId: string;
  clinicTimezone: string;
  initialAppointment: Appointment;
  patients: PatientClinicLink[];
  professionals: ClinicProfessionalLink[];
  canEdit: boolean;
  canChangeStatus: boolean;
  canReschedule: boolean;
  currentTimeIso: string;
};

type EditAppointmentFormValues = {
  patientClinicId: string;
  appointmentTypeCode: string;
  administrativeNote: string;
};

function getStatusClass(status: AppointmentStatus) {
  switch (status) {
    case "scheduled":
      return "bg-blue-100 text-blue-800";

    case "confirmed":
      return "bg-emerald-100 text-emerald-800";

    case "completed":
      return "bg-slate-200 text-slate-800";

    case "cancelled":
      return "bg-red-100 text-red-800";

    case "no_show":
      return "bg-amber-100 text-amber-800";
  }
}

async function readResponseMessage(response: Response) {
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

  return "Não foi possível atualizar o agendamento";
}

function appointmentToForm(
  appointment: Appointment,
): EditAppointmentFormValues {
  return {
    patientClinicId: appointment.patientClinicId,
    appointmentTypeCode:
      appointment.appointmentTypeCode ?? "",
    administrativeNote:
      appointment.administrativeNote ?? "",
  };
}

export function AppointmentListItem({
  clinicId,
  clinicTimezone,
  initialAppointment,
  patients,
  professionals,
  canEdit,
  canChangeStatus,
  canReschedule,
  currentTimeIso,
}: AppointmentListItemProps) {
  const router = useRouter();

  const [appointment, setAppointment] =
    useState(initialAppointment);

  const [isEditing, setIsEditing] = useState(false);

  const [formValues, setFormValues] =
    useState<EditAppointmentFormValues>(() =>
      appointmentToForm(initialAppointment),
    );

  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const [successMessage, setSuccessMessage] = useState<
    string | null
  >(null);

  function updateField(
    field: keyof EditAppointmentFormValues,
    value: string,
  ) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openEditForm() {
    setFormValues(appointmentToForm(appointment));
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsEditing(true);
  }

  function closeEditForm() {
    setFormValues(appointmentToForm(appointment));
    setErrorMessage(null);
    setIsEditing(false);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/appointments/${encodeURIComponent(
          appointment.id,
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            patientClinicId:
              formValues.patientClinicId,
            appointmentTypeCode:
              formValues.appointmentTypeCode,
            administrativeNote:
              formValues.administrativeNote,
            expectedVersion: appointment.version,
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

      const body =
        (await response.json()) as AppointmentResponse;

      setAppointment(body.appointment);
      setFormValues(
        appointmentToForm(body.appointment),
      );
      setIsEditing(false);
      setSuccessMessage(
        "Agendamento atualizado com sucesso.",
      );

      router.refresh();
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const isActiveAppointment =
    appointment.status === "scheduled" ||
    appointment.status === "confirmed";

  return (
    <article className="rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold">
            {appointment.patientClinic.patient.fullName}
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            {formatAppointmentDateTime(
              appointment.startsAt,
              clinicTimezone,
            )}{" "}
            até{" "}
            {formatAppointmentDateTime(
              appointment.endsAt,
              clinicTimezone,
            )}
          </p>
        </div>

        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
            appointment.status,
          )}`}
        >
          {getAppointmentStatusLabel(
            appointment.status,
          )}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 border-t pt-4 text-sm md:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">
            Profissional
          </dt>

          <dd className="font-medium">
            {
              appointment.clinicProfessional.professional
                .fullName
            }
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground">
            CRM
          </dt>

          <dd className="font-medium">
            {
              appointment.clinicProfessional.professional
                .crmState
            }{" "}
            {
              appointment.clinicProfessional.professional
                .crmNumber
            }
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground">
            Tipo
          </dt>

          <dd className="font-medium">
            {appointment.appointmentTypeCode ??
              "Não informado"}
          </dd>
        </div>
      </dl>

      {appointment.administrativeNote ? (
        <p className="mt-4 border-t pt-4 text-sm">
          {appointment.administrativeNote}
        </p>
      ) : null}

      {successMessage ? (
        <p
          className="mt-4 text-sm font-medium text-emerald-700"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}

      {canEdit &&
      isActiveAppointment &&
      !isEditing ? (
        <div className="mt-4 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={openEditForm}
          >
            Editar agendamento
          </Button>
        </div>
      ) : null}

      {isEditing ? (
        <form
          className="mt-4 space-y-5 border-t pt-4"
          onSubmit={handleSubmit}
        >
          <div>
            <h3 className="font-medium">
              Editar agendamento
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Altere o paciente ou as informações
              administrativas.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor={`edit-appointment-patient-${appointment.id}`}
              >
                Paciente
              </Label>

              <select
                id={`edit-appointment-patient-${appointment.id}`}
                required
                disabled={isSaving}
                value={formValues.patientClinicId}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  updateField(
                    "patientClinicId",
                    event.target.value,
                  )
                }
              >
                {patients.map((patientLink) => (
                  <option
                    key={patientLink.id}
                    value={patientLink.id}
                  >
                    {patientLink.patient.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor={`edit-appointment-type-${appointment.id}`}
              >
                Tipo de atendimento
              </Label>

              <Input
                id={`edit-appointment-type-${appointment.id}`}
                maxLength={60}
                disabled={isSaving}
                value={formValues.appointmentTypeCode}
                onChange={(event) =>
                  updateField(
                    "appointmentTypeCode",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label
                htmlFor={`edit-appointment-note-${appointment.id}`}
              >
                Observação administrativa
              </Label>

              <textarea
                id={`edit-appointment-note-${appointment.id}`}
                maxLength={500}
                disabled={isSaving}
                value={formValues.administrativeNote}
                className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  updateField(
                    "administrativeNote",
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
                ? "Salvando..."
                : "Salvar alterações"}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={closeEditForm}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {!isEditing ? (
        <>
          <AppointmentRescheduleAction
            clinicId={clinicId}
            clinicTimezone={clinicTimezone}
            appointment={appointment}
            professionals={professionals}
            canReschedule={canReschedule}
          />

          <AppointmentStatusActions
            clinicId={clinicId}
            appointment={appointment}
            canChangeStatus={canChangeStatus}
            currentTimeIso={currentTimeIso}
            onAppointmentChange={(
              updatedAppointment,
            ) => {
              setAppointment(
                updatedAppointment,
              );

              setFormValues(
                appointmentToForm(
                  updatedAppointment,
                ),
              );

              setSuccessMessage(null);
            }}
          />
        </>
      ) : null}
    </article>
  );
}