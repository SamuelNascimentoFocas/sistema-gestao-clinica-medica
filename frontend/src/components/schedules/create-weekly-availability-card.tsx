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
import type { ProfessionalWeeklyAvailability } from "@/types/professional";
import {
  EMPTY_WEEKLY_AVAILABILITY_FORM,
  WEEKDAYS,
  type WeeklyAvailabilityFormValues,
  type WeeklyAvailabilityResponse,
} from "@/types/schedule";

type CreateWeeklyAvailabilityCardProps = {
  clinicId: string;
  professionalId: string;
  onCreated: (
    availability: ProfessionalWeeklyAvailability,
  ) => void;
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

  return "Não foi possível cadastrar o horário semanal";
}

export function CreateWeeklyAvailabilityCard({
  clinicId,
  professionalId,
  onCreated,
}: CreateWeeklyAvailabilityCardProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);

  const [formValues, setFormValues] =
    useState<WeeklyAvailabilityFormValues>({
      ...EMPTY_WEEKLY_AVAILABILITY_FORM,
    });

  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const [successMessage, setSuccessMessage] = useState<
    string | null
  >(null);

  function updateField(
    field: keyof WeeklyAvailabilityFormValues,
    value: string,
  ) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setFormValues({
      ...EMPTY_WEEKLY_AVAILABILITY_FORM,
    });

    setErrorMessage(null);
  }

  function closeForm() {
    resetForm();
    setIsOpen(false);
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
        )}/professionals/${encodeURIComponent(
          professionalId,
        )}/weekly-availabilities`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            weekday: Number(formValues.weekday),
            startTime: formValues.startTime,
            endTime: formValues.endTime,
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
        (await response.json()) as WeeklyAvailabilityResponse;

      onCreated(body.availability);

      resetForm();
      setIsOpen(false);
      setSuccessMessage(
        "Horário semanal cadastrado.",
      );
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) {
    return (
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>
              Configurar disponibilidade semanal
            </CardTitle>

            <CardDescription>
              Adicione períodos recorrentes em que o
              profissional poderá realizar atendimentos.
            </CardDescription>
          </div>

          <Button
            type="button"
            onClick={() => {
              setSuccessMessage(null);
              setIsOpen(true);
            }}
          >
            Novo horário semanal
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
        <CardTitle>Novo horário semanal</CardTitle>

        <CardDescription>
          Informe o dia da semana e o período de
          disponibilidade.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          className="space-y-6"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="availability-weekday">
                Dia da semana
              </Label>

              <select
                id="availability-weekday"
                value={formValues.weekday}
                disabled={isSaving}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  updateField(
                    "weekday",
                    event.target.value,
                  )
                }
              >
                {WEEKDAYS.map((weekday) => (
                  <option
                    key={weekday.value}
                    value={weekday.value}
                  >
                    {weekday.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="availability-start-time">
                Horário inicial
              </Label>

              <Input
                id="availability-start-time"
                type="time"
                required
                disabled={isSaving}
                value={formValues.startTime}
                onChange={(event) =>
                  updateField(
                    "startTime",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="availability-end-time">
                Horário final
              </Label>

              <Input
                id="availability-end-time"
                type="time"
                required
                disabled={isSaving}
                value={formValues.endTime}
                onChange={(event) =>
                  updateField(
                    "endTime",
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
                ? "Cadastrando..."
                : "Cadastrar horário"}
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