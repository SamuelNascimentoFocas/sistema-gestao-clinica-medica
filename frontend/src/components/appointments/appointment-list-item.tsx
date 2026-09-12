"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { appointmentEditFormSchema } from "@/lib/forms/form-schemas";
import { FormFieldError } from "@/components/ui/form-field-error";

import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { getCompletedAppointmentMedicalRecordHref } from "@/lib/medical-records/medical-record-entry-context";

type AppointmentListItemProps = {
  clinicId: string;
  clinicTimezone: string;
  initialAppointment: Appointment;
  patients: PatientClinicLink[];
  professionals: ClinicProfessionalLink[];
  canEdit: boolean;
  canChangeStatus: boolean;
  canReschedule: boolean;
  canCreateMedicalRecordEntries: boolean;
  currentTimeIso: string;
  actionsOnly?: boolean;
  onChanged?: () => void;
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

  return "Não foi possível atualizar o agendamento";
}

function appointmentToForm(
  appointment: Appointment,
): EditAppointmentFormValues {
  return {
    patientClinicId: appointment.patientClinicId,
    appointmentTypeCode: appointment.appointmentTypeCode ?? "",
    administrativeNote: appointment.administrativeNote ?? "",
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
  canCreateMedicalRecordEntries,
  currentTimeIso,
  actionsOnly = false,
  onChanged,
}: AppointmentListItemProps) {
  const router = useRouter();

  const [appointment, setAppointment] = useState(initialAppointment);

  const [isEditing, setIsEditing] = useState(false);

  const {
    control,
    register,
    reset,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<EditAppointmentFormValues>({
    resolver: zodResolver(appointmentEditFormSchema),
    defaultValues: appointmentToForm(initialAppointment),
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function openEditForm() {
    reset(appointmentToForm(appointment));
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsEditing(true);
  }

  function closeEditForm() {
    reset(appointmentToForm(appointment));
    setErrorMessage(null);
    setIsEditing(false);
  }

  async function handleSubmit(formValues: EditAppointmentFormValues) {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/appointments/${encodeURIComponent(appointment.id)}`,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          patientClinicId: formValues.patientClinicId,
          appointmentTypeCode: formValues.appointmentTypeCode,
          administrativeNote: formValues.administrativeNote,
          expectedVersion: appointment.version,
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

      const body = (await readBrowserJson(response)) as AppointmentResponse;

      setAppointment(body.appointment);
      reset(appointmentToForm(body.appointment));
      setIsEditing(false);
      setSuccessMessage("Agendamento atualizado com sucesso.");

      router.refresh();
      onChanged?.();
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor");
    }
  }

  const isActiveAppointment =
    appointment.status === "scheduled" || appointment.status === "confirmed";

  const medicalRecordHref = getCompletedAppointmentMedicalRecordHref({
    clinicId,
    patientId: appointment.patientClinic.patient.id,
    appointmentId: appointment.id,
    appointmentStatus: appointment.status,
    canCreateMedicalRecordEntries,
  });

  return (
    <article className={actionsOnly ? "min-w-56" : "rounded-lg border p-4"}>
      {!actionsOnly ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold">
            {appointment.patientClinic.patient.fullName}
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            {formatAppointmentDateTime(appointment.startsAt, clinicTimezone)}{" "}
            até {formatAppointmentDateTime(appointment.endsAt, clinicTimezone)}
          </p>
        </div>

        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
            appointment.status,
          )}`}
        >
          {getAppointmentStatusLabel(appointment.status)}
        </span>
          </div>

          <dl className="mt-4 grid gap-3 border-t pt-4 text-sm md:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Profissional</dt>

          <dd className="font-medium">
            {appointment.clinicProfessional.professional.fullName}
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground">CRM</dt>

          <dd className="font-medium">
            {appointment.clinicProfessional.professional.crmState}{" "}
            {appointment.clinicProfessional.professional.crmNumber}
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground">Tipo</dt>

          <dd className="font-medium">
            {appointment.appointmentTypeCode ?? "Não informado"}
          </dd>
        </div>
          </dl>

          {appointment.administrativeNote ? (
            <p className="mt-4 border-t pt-4 text-sm">
              {appointment.administrativeNote}
            </p>
          ) : null}
        </>
      ) : null}

      {successMessage ? (
        <p className="mt-4 text-sm font-medium text-emerald-700" role="status">
          {successMessage}
        </p>
      ) : null}

      {medicalRecordHref ? (
        <div className="mt-4 border-t pt-4">
          <Link
            href={medicalRecordHref}
            className={buttonVariants({ variant: "outline" })}
          >
            Registrar no prontuário
          </Link>
        </div>
      ) : null}

      {canEdit && isActiveAppointment && !isEditing ? (
        <div className="mt-4 border-t pt-4">
          <Button type="button" variant="outline" onClick={openEditForm}>
            Editar agendamento
          </Button>
        </div>
      ) : null}

      {isEditing ? (
        <form
          className="mt-4 space-y-5 border-t pt-4"
          onSubmit={submitForm(handleSubmit)}
        >
          <div>
            <h3 className="font-medium">Editar agendamento</h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Altere o paciente ou as informações administrativas.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`edit-appointment-patient-${appointment.id}`}>
                Paciente
              </Label>

              <select
                {...register("patientClinicId")}
                aria-invalid={!!errors.patientClinicId}
                aria-describedby={
                  errors.patientClinicId
                    ? `edit-appointment-patient-${appointment.id}` + "-error"
                    : undefined
                }
                id={`edit-appointment-patient-${appointment.id}`}
                required
                disabled={isSaving}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {patients.map((patientLink) => (
                  <option key={patientLink.id} value={patientLink.id}>
                    {patientLink.patient.fullName}
                  </option>
                ))}
              </select>
              <FormFieldError
                id={`edit-appointment-patient-${appointment.id}` + "-error"}
                message={errors.patientClinicId?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`edit-appointment-type-${appointment.id}`}>
                Tipo de atendimento
              </Label>

              <Controller
                control={control}
                name="appointmentTypeCode"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.appointmentTypeCode}
                    aria-describedby={
                      errors.appointmentTypeCode
                        ? `edit-appointment-type-${appointment.id}` + "-error"
                        : undefined
                    }
                    id={`edit-appointment-type-${appointment.id}`}
                    maxLength={60}
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={`edit-appointment-type-${appointment.id}` + "-error"}
                message={errors.appointmentTypeCode?.message}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor={`edit-appointment-note-${appointment.id}`}>
                Observação administrativa
              </Label>

              <textarea
                {...register("administrativeNote")}
                aria-invalid={!!errors.administrativeNote}
                aria-describedby={
                  errors.administrativeNote
                    ? `edit-appointment-note-${appointment.id}` + "-error"
                    : undefined
                }
                id={`edit-appointment-note-${appointment.id}`}
                maxLength={500}
                disabled={isSaving}
                className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <FormFieldError
                id={`edit-appointment-note-${appointment.id}` + "-error"}
                message={errors.administrativeNote?.message}
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
            onAppointmentChange={(updatedAppointment) => {
              setAppointment(updatedAppointment);
              reset(appointmentToForm(updatedAppointment));
              setSuccessMessage(null);
              onChanged?.();
            }}
          />
        </>
      ) : null}
    </article>
  );
}
