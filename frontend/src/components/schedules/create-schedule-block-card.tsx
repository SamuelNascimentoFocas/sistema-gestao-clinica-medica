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
import type { ProfessionalScheduleBlock } from "@/types/professional";
import {
  EMPTY_SCHEDULE_BLOCK_FORM,
  type ScheduleBlockFormValues,
  type ScheduleBlockResponse,
} from "@/types/schedule";

type CreateScheduleBlockCardProps = {
  clinicId: string;
  professionalId: string;
  onCreated: (
    scheduleBlock: ProfessionalScheduleBlock,
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

  return "Não foi possível cadastrar o bloqueio";
}

export function CreateScheduleBlockCard({
  clinicId,
  professionalId,
  onCreated,
}: CreateScheduleBlockCardProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);

  const [formValues, setFormValues] =
    useState<ScheduleBlockFormValues>({
      ...EMPTY_SCHEDULE_BLOCK_FORM,
    });

  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const [successMessage, setSuccessMessage] = useState<
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

  function resetForm() {
    setFormValues({
      ...EMPTY_SCHEDULE_BLOCK_FORM,
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
        )}/schedule-blocks`,
        {
          method: "POST",
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

      onCreated(body.scheduleBlock);

      resetForm();
      setIsOpen(false);
      setSuccessMessage(
        "Bloqueio de agenda cadastrado.",
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
              Configurar bloqueios de agenda
            </CardTitle>

            <CardDescription>
              Registre períodos excepcionais de
              indisponibilidade do profissional.
            </CardDescription>
          </div>

          <Button
            type="button"
            onClick={() => {
              setSuccessMessage(null);
              setIsOpen(true);
            }}
          >
            Novo bloqueio
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
        <CardTitle>Novo bloqueio</CardTitle>

        <CardDescription>
          Informe o início, o fim e, opcionalmente, o
          motivo da indisponibilidade.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          className="space-y-6"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="schedule-block-start">
                Início
              </Label>

              <Input
                id="schedule-block-start"
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
              <Label htmlFor="schedule-block-end">
                Fim
              </Label>

              <Input
                id="schedule-block-end"
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
              <Label htmlFor="schedule-block-reason">
                Motivo
              </Label>

              <Input
                id="schedule-block-reason"
                maxLength={240}
                disabled={isSaving}
                value={formValues.reason}
                placeholder="Ex.: Congresso médico"
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
                ? "Cadastrando..."
                : "Cadastrar bloqueio"}
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