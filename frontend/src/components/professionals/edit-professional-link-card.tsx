"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { professionalLinkFormSchema } from "@/lib/forms/form-schemas";
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
import {
  professionalLinkToEditForm,
  type ClinicProfessionalLink,
  type EditProfessionalLinkFormValues,
  type ProfessionalLinkResponse,
} from "@/types/professional";

type EditProfessionalLinkCardProps = {
  clinicId: string;
  professionalLink: ClinicProfessionalLink;
  onUpdated: (professionalLink: ClinicProfessionalLink) => void;
  onCancel: () => void;
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

  return "Não foi possível atualizar o vínculo profissional";
}

export function EditProfessionalLinkCard({
  clinicId,
  professionalLink,
  onUpdated,
  onCancel,
}: EditProfessionalLinkCardProps) {
  const router = useRouter();

  const {
    control,
    register,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<EditProfessionalLinkFormValues>({
    resolver: zodResolver(professionalLinkFormSchema),
    defaultValues: professionalLinkToEditForm(professionalLink),
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(formValues: EditProfessionalLinkFormValues) {
    setErrorMessage(null);

    const duration = Number(formValues.defaultAppointmentDurationMinutes);

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
          defaultAppointmentDurationMinutes: duration,
          acceptsAppointments: formValues.acceptsAppointments,
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

      const body = (await readBrowserJson(
        response,
      )) as ProfessionalLinkResponse;

      onUpdated(body.professionalLink);
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Editar vínculo de {professionalLink.professional.fullName}
        </CardTitle>

        <CardDescription>
          Altere as configurações específicas deste profissional na clínica
          atual.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-6" onSubmit={submitForm(handleSubmit)}>
          <div className="rounded-md border bg-muted/30 p-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">CRM</dt>

                <dd className="font-medium">
                  {professionalLink.professional.crmState}{" "}
                  {professionalLink.professional.crmNumber}
                </dd>
              </div>

              <div>
                <dt className="text-muted-foreground">Especialidade</dt>

                <dd className="font-medium">
                  {professionalLink.professional.specialty}
                </dd>
              </div>

              <div>
                <dt className="text-muted-foreground">Conta vinculada</dt>

                <dd className="break-words font-medium">
                  {professionalLink.professional.user?.email ?? "Não vinculada"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-professional-local-code">Código local</Label>

              <Controller
                control={control}
                name="localCode"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.localCode}
                    aria-describedby={
                      errors.localCode
                        ? "edit-professional-local-code-error"
                        : undefined
                    }
                    id="edit-professional-local-code"
                    maxLength={60}
                    disabled={isSaving}
                    placeholder="Ex.: MED-001"
                  />
                )}
              />
              <FormFieldError
                id={"edit-professional-local-code-error"}
                message={errors.localCode?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-professional-duration">
                Duração padrão da consulta
              </Label>

              <Controller
                control={control}
                name="defaultAppointmentDurationMinutes"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.defaultAppointmentDurationMinutes}
                    aria-describedby={
                      errors.defaultAppointmentDurationMinutes
                        ? "edit-professional-duration-error"
                        : undefined
                    }
                    id="edit-professional-duration"
                    type="number"
                    required
                    min={5}
                    max={480}
                    step={1}
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={"edit-professional-duration-error"}
                message={errors.defaultAppointmentDurationMinutes?.message}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-3 text-sm">
                <input
                  {...register("acceptsAppointments")}
                  id={"professionalLinkFormSchema-acceptsAppointments"}
                  aria-invalid={!!errors.acceptsAppointments}
                  aria-describedby={
                    errors.acceptsAppointments
                      ? "professionalLinkFormSchema-acceptsAppointments-error"
                      : undefined
                  }
                  type="checkbox"
                  disabled={isSaving}
                />
                <FormFieldError
                  id={"professionalLinkFormSchema-acceptsAppointments-error"}
                  message={errors.acceptsAppointments?.message}
                />

                <span>Este profissional aceita agendamentos</span>
              </label>
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
