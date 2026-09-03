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
import type { ProfessionalWeeklyAvailability } from "@/types/professional";
import {
  WEEKDAYS,
  weeklyAvailabilityToForm,
  type WeeklyAvailabilityFormValues,
  type WeeklyAvailabilityResponse,
} from "@/types/schedule";

type EditWeeklyAvailabilityCardProps = {
  clinicId: string;
  professionalId: string;
  availability: ProfessionalWeeklyAvailability;
  onUpdated: (
    availability: ProfessionalWeeklyAvailability,
  ) => void;
  onCancel: () => void;
};

async function readResponseMessage(response: BrowserResponse) {
  const body: unknown = await readBrowserJson(response)
    .catch(() => null);

  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return "Não foi possível atualizar o horário semanal";
}

export function EditWeeklyAvailabilityCard({
  clinicId,
  professionalId,
  availability,
  onUpdated,
  onCancel,
}: EditWeeklyAvailabilityCardProps) {
  const router = useRouter();

  const [formValues, setFormValues] =
    useState<WeeklyAvailabilityFormValues>(() =>
      weeklyAvailabilityToForm(availability),
    );

  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState<
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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals/${encodeURIComponent(
          professionalId,
        )}/weekly-availabilities/${encodeURIComponent(
          availability.id,
        )}`,
        method: "PATCH",
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
        setErrorMessage(
          await readResponseMessage(response),
        );

        return;
      }

      const body =
        (await readBrowserJson(response)) as WeeklyAvailabilityResponse;

      onUpdated(body.availability);
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-md border p-4">
      <form
        className="space-y-4"
        onSubmit={handleSubmit}
      >
        <div>
          <h3 className="font-medium">
            Editar horário semanal
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Altere o dia ou o período de disponibilidade.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label
              htmlFor={`edit-availability-weekday-${availability.id}`}
            >
              Dia da semana
            </Label>

            <select
              id={`edit-availability-weekday-${availability.id}`}
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
            <Label
              htmlFor={`edit-availability-start-${availability.id}`}
            >
              Horário inicial
            </Label>

            <Input
              id={`edit-availability-start-${availability.id}`}
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
            <Label
              htmlFor={`edit-availability-end-${availability.id}`}
            >
              Horário final
            </Label>

            <Input
              id={`edit-availability-end-${availability.id}`}
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
              ? "Salvando..."
              : "Salvar alterações"}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
