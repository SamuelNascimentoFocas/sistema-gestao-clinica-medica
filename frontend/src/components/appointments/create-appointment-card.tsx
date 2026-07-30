"use client";

import { FormEvent, useState } from "react";
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

  return "Não foi possível criar o agendamento";
}

export function CreateAppointmentCard({
  clinicId,
  clinicTimezone,
  patients,
  professionals,
}: CreateAppointmentCardProps) {
  const router = useRouter();

  const initialProfessional =
    professionals[0] ?? null;

  const [isOpen, setIsOpen] = useState(false);

  const [formValues, setFormValues] =
    useState<CreateAppointmentFormValues>({
      ...EMPTY_CREATE_APPOINTMENT_FORM,
      clinicProfessionalId:
        initialProfessional?.id ?? "",
      durationMinutes: String(
        initialProfessional
          ?.defaultAppointmentDurationMinutes ?? 30,
      ),
    });

  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const [successMessage, setSuccessMessage] = useState<
    string | null
  >(null);

  function updateField(
    field: keyof CreateAppointmentFormValues,
    value: string,
  ) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setFormValues({
      ...EMPTY_CREATE_APPOINTMENT_FORM,
      clinicProfessionalId:
        initialProfessional?.id ?? "",
      durationMinutes: String(
        initialProfessional
          ?.defaultAppointmentDurationMinutes ?? 30,
      ),
    });

    setErrorMessage(null);
  }

  function handleProfessionalChange(
    professionalId: string,
  ) {
    const professional = professionals.find(
      (item) => item.id === professionalId,
    );

    setFormValues((current) => ({
      ...current,
      clinicProfessionalId: professionalId,
      durationMinutes: String(
        professional
          ?.defaultAppointmentDurationMinutes ?? 30,
      ),
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

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
      setErrorMessage("Data e horário inválidos");
      setIsSaving(false);

      return;
    }

    try {
      const response = await fetch(
        `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/appointments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            patientClinicId:
              formValues.patientClinicId,
            clinicProfessionalId:
              formValues.clinicProfessionalId,
            startsAt,
            durationMinutes,
            appointmentTypeCode:
              formValues.appointmentTypeCode,
            administrativeNote:
              formValues.administrativeNote,
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

      if (!body.appointment) {
        setErrorMessage(
          "O servidor retornou um agendamento inválido",
        );

        return;
      }

      resetForm();
      setIsOpen(false);
      setSuccessMessage(
        "Agendamento criado com sucesso.",
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

  if (
    patients.length === 0 ||
    professionals.length === 0
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Novo agendamento</CardTitle>

          <CardDescription>
            Não há pacientes ativos ou profissionais
            disponíveis para receber agendamentos.
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
              Marque um atendimento respeitando a agenda
              disponível do profissional.
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
            <p
              className="text-sm font-medium text-emerald-700"
              role="status"
            >
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
        <form
          className="space-y-6"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-appointment-patient">
                Paciente
              </Label>

              <select
                id="new-appointment-patient"
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
                <option value="">
                  Selecione um paciente
                </option>

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
              <Label htmlFor="new-appointment-professional">
                Profissional
              </Label>

              <select
                id="new-appointment-professional"
                required
                disabled={isSaving}
                value={
                  formValues.clinicProfessionalId
                }
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  handleProfessionalChange(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Selecione um profissional
                </option>

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
              <Label htmlFor="new-appointment-start">
                Data e horário
              </Label>

              <Input
                id="new-appointment-start"
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
              <Label htmlFor="new-appointment-duration">
                Duração em minutos
              </Label>

              <Input
                id="new-appointment-duration"
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
              <Label htmlFor="new-appointment-type">
                Tipo de atendimento
              </Label>

              <Input
                id="new-appointment-type"
                maxLength={60}
                disabled={isSaving}
                value={formValues.appointmentTypeCode}
                placeholder="Ex.: Consulta"
                onChange={(event) =>
                  updateField(
                    "appointmentTypeCode",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-appointment-note">
                Observação administrativa
              </Label>

              <textarea
                id="new-appointment-note"
                maxLength={500}
                disabled={isSaving}
                value={formValues.administrativeNote}
                className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Informação opcional"
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
                ? "Criando..."
                : "Criar agendamento"}
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