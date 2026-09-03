"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { appointmentFormSchema } from "@/lib/forms/form-schemas";
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
import { localDateTimeToUtcIso } from "@/lib/appointments/appointment-date";
import type { PatientClinicLink } from "@/types/patient";
import type { ClinicProfessionalLink } from "@/types/professional";
import {
  EMPTY_CREATE_APPOINTMENT_FORM,
  type AppointmentResponse,
  type CreateAppointmentFormValues,
} from "@/types/appointment";

type CreateAppointmentCardProps = {
  clinicId: string;
  clinicTimezone: string;
  patients: PatientClinicLink[];
  professionals: ClinicProfessionalLink[];
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

  return "Não foi possível criar o agendamento";
}

export function CreateAppointmentCard({
  clinicId,
  clinicTimezone,
  patients,
  professionals,
}: CreateAppointmentCardProps) {
  const router = useRouter();

  const initialProfessional = professionals[0] ?? null;

  const [isOpen, setIsOpen] = useState(false);

  const {
    control,
    register,
    reset,
    setValue,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<CreateAppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      ...EMPTY_CREATE_APPOINTMENT_FORM,
      clinicProfessionalId: initialProfessional?.id ?? "",
      durationMinutes: String(
        initialProfessional?.defaultAppointmentDurationMinutes ?? 30,
      ),
    },
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function resetForm() {
    reset({
      ...EMPTY_CREATE_APPOINTMENT_FORM,
      clinicProfessionalId: initialProfessional?.id ?? "",
      durationMinutes: String(
        initialProfessional?.defaultAppointmentDurationMinutes ?? 30,
      ),
    });

    setErrorMessage(null);
  }

  function handleProfessionalChange(professionalId: string) {
    const professional = professionals.find(
      (item) => item.id === professionalId,
    );
    setValue(
      "durationMinutes",
      String(professional?.defaultAppointmentDurationMinutes ?? 30),
      { shouldDirty: true },
    );
  }

  async function handleSubmit(formValues: CreateAppointmentFormValues) {
    setErrorMessage(null);
    setSuccessMessage(null);

    const durationMinutes = Number(formValues.durationMinutes);

    let startsAt: string;

    try {
      startsAt = localDateTimeToUtcIso(formValues.startsAt, clinicTimezone);
    } catch {
      setErrorMessage("Data e horário inválidos");

      return;
    }

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(clinicId)}/appointments`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          patientClinicId: formValues.patientClinicId,
          clinicProfessionalId: formValues.clinicProfessionalId,
          startsAt,
          durationMinutes,
          appointmentTypeCode: formValues.appointmentTypeCode,
          administrativeNote: formValues.administrativeNote,
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

      if (!body.appointment) {
        setErrorMessage("O servidor retornou um agendamento inválido");

        return;
      }

      resetForm();
      setIsOpen(false);
      setSuccessMessage("Agendamento criado com sucesso.");

      router.refresh();
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor");
    }
  }

  if (patients.length === 0 || professionals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Novo agendamento</CardTitle>

          <CardDescription>
            Não há pacientes ativos ou profissionais disponíveis para receber
            agendamentos.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isOpen) {
    return (
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Novo agendamento</CardTitle>

            <CardDescription>
              Marque um atendimento respeitando a agenda disponível do
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
            Criar agendamento
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
        <CardTitle>Novo agendamento</CardTitle>

        <CardDescription>
          Informe paciente, profissional, data e duração.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-6" onSubmit={submitForm(handleSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-appointment-patient">Paciente</Label>

              <select
                {...register("patientClinicId")}
                aria-invalid={!!errors.patientClinicId}
                aria-describedby={
                  errors.patientClinicId
                    ? "new-appointment-patient-error"
                    : undefined
                }
                id="new-appointment-patient"
                required
                disabled={isSaving}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione um paciente</option>

                {patients.map((patientLink) => (
                  <option key={patientLink.id} value={patientLink.id}>
                    {patientLink.patient.fullName}
                  </option>
                ))}
              </select>
              <FormFieldError
                id={"new-appointment-patient-error"}
                message={errors.patientClinicId?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-appointment-professional">Profissional</Label>

              <Controller
                control={control}
                name="clinicProfessionalId"
                render={({ field }) => (
                  <select
                    {...field}
                    aria-invalid={!!errors.clinicProfessionalId}
                    aria-describedby={
                      errors.clinicProfessionalId
                        ? "new-appointment-professional-error"
                        : undefined
                    }
                    onChange={(event) => {
                      field.onChange(event);
                      handleProfessionalChange(event.target.value);
                    }}
                    id="new-appointment-professional"
                    required
                    disabled={isSaving}
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Selecione um profissional</option>
                    {professionals.map((professionalLink) => (
                      <option
                        key={professionalLink.id}
                        value={professionalLink.id}
                      >
                        {professionalLink.professional.fullName} — CRM{" "}
                        {professionalLink.professional.crmState}{" "}
                        {professionalLink.professional.crmNumber}
                      </option>
                    ))}
                  </select>
                )}
              />
              <FormFieldError
                id={"new-appointment-professional-error"}
                message={errors.clinicProfessionalId?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-appointment-start">Data e horário</Label>

              <Controller
                control={control}
                name="startsAt"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.startsAt}
                    aria-describedby={
                      errors.startsAt
                        ? "new-appointment-start-error"
                        : undefined
                    }
                    id="new-appointment-start"
                    type="datetime-local"
                    required
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={"new-appointment-start-error"}
                message={errors.startsAt?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-appointment-duration">
                Duração em minutos
              </Label>

              <Controller
                control={control}
                name="durationMinutes"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.durationMinutes}
                    aria-describedby={
                      errors.durationMinutes
                        ? "new-appointment-duration-error"
                        : undefined
                    }
                    id="new-appointment-duration"
                    type="number"
                    min={5}
                    max={480}
                    step={1}
                    required
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={"new-appointment-duration-error"}
                message={errors.durationMinutes?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-appointment-type">Tipo de atendimento</Label>

              <Controller
                control={control}
                name="appointmentTypeCode"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.appointmentTypeCode}
                    aria-describedby={
                      errors.appointmentTypeCode
                        ? "new-appointment-type-error"
                        : undefined
                    }
                    id="new-appointment-type"
                    maxLength={60}
                    disabled={isSaving}
                    placeholder="Ex.: Consulta"
                  />
                )}
              />
              <FormFieldError
                id={"new-appointment-type-error"}
                message={errors.appointmentTypeCode?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-appointment-note">
                Observação administrativa
              </Label>

              <textarea
                {...register("administrativeNote")}
                aria-invalid={!!errors.administrativeNote}
                aria-describedby={
                  errors.administrativeNote
                    ? "new-appointment-note-error"
                    : undefined
                }
                id="new-appointment-note"
                maxLength={500}
                disabled={isSaving}
                className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Informação opcional"
              />
              <FormFieldError
                id={"new-appointment-note-error"}
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
              {isSaving ? "Criando..." : "Criar agendamento"}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => {
                resetForm();
                setIsOpen(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
