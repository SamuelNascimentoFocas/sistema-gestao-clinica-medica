"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfessionalScheduleBlock } from "@/types/professional";
import {
  scheduleBlockToForm,
  type ScheduleBlockFormValues,
  type ScheduleBlockResponse,
} from "@/types/schedule";

type EditScheduleBlockCardProps = {
  clinicId: string;
  professionalId: string;
  scheduleBlock: ProfessionalScheduleBlock;
  onUpdated: (
    scheduleBlock: ProfessionalScheduleBlock,
  ) => void;
  onCancel: () => void;
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

  return "Não foi possível atualizar o bloqueio";
}

export function EditScheduleBlockCard({
  clinicId,
  professionalId,
  scheduleBlock,
  onUpdated,
  onCancel,
}: EditScheduleBlockCardProps) {
  const router = useRouter();

  const [formValues, setFormValues] =
    useState<ScheduleBlockFormValues>(() =>
      scheduleBlockToForm(scheduleBlock),
    );

  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  function updateField(
    field: keyof ScheduleBlockFormValues,
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

    const startsAt = new Date(formValues.startsAt);
    const endsAt = new Date(formValues.endsAt);

    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime())
    ) {
      setErrorMessage(
        "Informe datas e horários válidos",
      );
      setIsSaving(false);

      return;
    }

    if (startsAt.getTime() >= endsAt.getTime()) {
      setErrorMessage(
        "O início do bloqueio deve ser anterior ao fim",
      );
      setIsSaving(false);

      return;
    }

    try {
      const response = await fetch(
        `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals/${encodeURIComponent(
          professionalId,
        )}/schedule-blocks/${encodeURIComponent(
          scheduleBlock.id,
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            reason: formValues.reason,
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
        (await response.json()) as ScheduleBlockResponse;

      onUpdated(body.scheduleBlock);
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
            Editar bloqueio
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Altere o período ou o motivo da
            indisponibilidade.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label
              htmlFor={`edit-block-start-${scheduleBlock.id}`}
            >
              Início
            </Label>

            <Input
              id={`edit-block-start-${scheduleBlock.id}`}
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
              htmlFor={`edit-block-end-${scheduleBlock.id}`}
            >
              Fim
            </Label>

            <Input
              id={`edit-block-end-${scheduleBlock.id}`}
              type="datetime-local"
              required
              disabled={isSaving}
              value={formValues.endsAt}
              onChange={(event) =>
                updateField(
                  "endsAt",
                  event.target.value,
                )
              }
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label
              htmlFor={`edit-block-reason-${scheduleBlock.id}`}
            >
              Motivo
            </Label>

            <Input
              id={`edit-block-reason-${scheduleBlock.id}`}
              maxLength={240}
              disabled={isSaving}
              value={formValues.reason}
              onChange={(event) =>
                updateField(
                  "reason",
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