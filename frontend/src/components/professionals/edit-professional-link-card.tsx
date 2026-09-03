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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  professionalLinkToEditForm,
  type ClinicProfessionalLink,
  type EditProfessionalLinkFormValues,
  type ProfessionalLinkResponse,
} from "@/types/professional";

type EditProfessionalLinkCardProps = {
  clinicId: string;
  professionalLink: ClinicProfessionalLink;
  onUpdated: (
    professionalLink: ClinicProfessionalLink,
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

  return "Não foi possível atualizar o vínculo profissional";
}

export function EditProfessionalLinkCard({
  clinicId,
  professionalLink,
  onUpdated,
  onCancel,
}: EditProfessionalLinkCardProps) {
  const router = useRouter();

  const [formValues, setFormValues] =
    useState<EditProfessionalLinkFormValues>(() =>
      professionalLinkToEditForm(professionalLink),
    );

  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  function updateField(
    field: keyof EditProfessionalLinkFormValues,
    value: string | boolean,
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

    const duration = Number(
      formValues.defaultAppointmentDurationMinutes,
    );

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals/${encodeURIComponent(
          professionalLink.professional.id,
        )}`,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          localCode: formValues.localCode,
          defaultAppointmentDurationMinutes:
            duration,
          acceptsAppointments:
            formValues.acceptsAppointments,
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
        (await readBrowserJson(response)) as ProfessionalLinkResponse;

      onUpdated(body.professionalLink);
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Editar vínculo de{" "}
          {professionalLink.professional.fullName}
        </CardTitle>

        <CardDescription>
          Altere as configurações específicas deste
          profissional na clínica atual.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          className="space-y-6"
          onSubmit={handleSubmit}
        >
          <div className="rounded-md border bg-muted/30 p-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">
                  CRM
                </dt>

                <dd className="font-medium">
                  {
                    professionalLink.professional
                      .crmState
                  }{" "}
                  {
                    professionalLink.professional
                      .crmNumber
                  }
                </dd>
              </div>

              <div>
                <dt className="text-muted-foreground">
                  Especialidade
                </dt>

                <dd className="font-medium">
                  {
                    professionalLink.professional
                      .specialty
                  }
                </dd>
              </div>

              <div>
                <dt className="text-muted-foreground">
                  Conta vinculada
                </dt>

                <dd className="break-words font-medium">
                  {professionalLink.professional.user
                    ?.email ?? "Não vinculada"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-professional-local-code">
                Código local
              </Label>

              <Input
                id="edit-professional-local-code"
                maxLength={60}
                disabled={isSaving}
                value={formValues.localCode}
                placeholder="Ex.: MED-001"
                onChange={(event) =>
                  updateField(
                    "localCode",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-professional-duration">
                Duração padrão da consulta
              </Label>

              <Input
                id="edit-professional-duration"
                type="number"
                required
                min={5}
                max={480}
                step={1}
                disabled={isSaving}
                value={
                  formValues.defaultAppointmentDurationMinutes
                }
                onChange={(event) =>
                  updateField(
                    "defaultAppointmentDurationMinutes",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={
                    formValues.acceptsAppointments
                  }
                  disabled={isSaving}
                  onChange={(event) =>
                    updateField(
                      "acceptsAppointments",
                      event.target.checked,
                    )
                  }
                />

                <span>
                  Este profissional aceita agendamentos
                </span>
              </label>
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
      </CardContent>
    </Card>
  );
}
