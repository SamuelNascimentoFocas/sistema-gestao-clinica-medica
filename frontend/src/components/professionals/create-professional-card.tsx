"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { professionalFormSchema } from "@/lib/forms/form-schemas";
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
  EMPTY_PROFESSIONAL_FORM,
  type ClinicProfessionalLink,
  type CreateProfessionalFormValues,
  type ProfessionalLinkResponse,
  type ProfessionalUserOption,
} from "@/types/professional";

type CreateProfessionalCardProps = {
  clinicId: string;
  doctorOptions: ProfessionalUserOption[];
  onCreated: (professionalLink: ClinicProfessionalLink) => void;
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

  return "Não foi possível cadastrar o profissional";
}

export function CreateProfessionalCard({
  clinicId,
  doctorOptions,
  onCreated,
}: CreateProfessionalCardProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);

  const {
    control,
    register,
    reset,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<CreateProfessionalFormValues>({
    resolver: zodResolver(professionalFormSchema),
    defaultValues: {
      ...EMPTY_PROFESSIONAL_FORM,
    },
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function resetForm() {
    reset({
      ...EMPTY_PROFESSIONAL_FORM,
    });

    setErrorMessage(null);
  }

  function closeForm() {
    resetForm();
    setIsOpen(false);
  }

  async function handleSubmit(formValues: CreateProfessionalFormValues) {
    setErrorMessage(null);
    setSuccessMessage(null);

    const duration = Number(formValues.defaultAppointmentDurationMinutes);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(clinicId)}/professionals`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          fullName: formValues.fullName,
          crmNumber: formValues.crmNumber,
          crmState: formValues.crmState,
          specialty: formValues.specialty,
          phone: formValues.phone,
          email: formValues.email,
          userId: formValues.userId || null,
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

      onCreated(body.professionalLink);

      resetForm();
      setIsOpen(false);
      setSuccessMessage("Profissional cadastrado e vinculado à clínica.");
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor");
    }
  }

  if (!isOpen) {
    return (
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Cadastro de profissionais</CardTitle>

            <CardDescription>
              Cadastre um profissional e configure seu vínculo de atendimento
              com a clínica.
            </CardDescription>
          </div>

          <Button
            type="button"
            onClick={() => {
              setSuccessMessage(null);
              setIsOpen(true);
            }}
          >
            Novo profissional
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
        <CardTitle>Novo profissional</CardTitle>

        <CardDescription>
          Informe os dados profissionais e as configurações específicas desta
          clínica.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-6" onSubmit={submitForm(handleSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="professional-full-name">Nome completo</Label>

              <Controller
                control={control}
                name="fullName"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.fullName}
                    aria-describedby={
                      errors.fullName
                        ? "professional-full-name-error"
                        : undefined
                    }
                    id="professional-full-name"
                    required
                    minLength={3}
                    maxLength={180}
                    disabled={isSaving}
                    autoComplete="name"
                  />
                )}
              />
              <FormFieldError
                id={"professional-full-name-error"}
                message={errors.fullName?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professional-crm-number">Número do CRM</Label>

              <Controller
                control={control}
                name="crmNumber"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.crmNumber}
                    aria-describedby={
                      errors.crmNumber
                        ? "professional-crm-number-error"
                        : undefined
                    }
                    onChange={(event) =>
                      field.onChange(event.target.value.toUpperCase())
                    }
                    id="professional-crm-number"
                    required
                    minLength={1}
                    maxLength={30}
                    disabled={isSaving}
                    placeholder="Ex.: 12345"
                  />
                )}
              />
              <FormFieldError
                id={"professional-crm-number-error"}
                message={errors.crmNumber?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professional-crm-state">UF do CRM</Label>

              <Controller
                control={control}
                name="crmState"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.crmState}
                    aria-describedby={
                      errors.crmState
                        ? "professional-crm-state-error"
                        : undefined
                    }
                    onChange={(event) =>
                      field.onChange(
                        event.target.value
                          .replace(/[^A-Za-z]/g, "")
                          .toUpperCase(),
                      )
                    }
                    id="professional-crm-state"
                    required
                    minLength={2}
                    maxLength={2}
                    disabled={isSaving}
                    placeholder="MG"
                  />
                )}
              />
              <FormFieldError
                id={"professional-crm-state-error"}
                message={errors.crmState?.message}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="professional-specialty">Especialidade</Label>

              <Controller
                control={control}
                name="specialty"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.specialty}
                    aria-describedby={
                      errors.specialty
                        ? "professional-specialty-error"
                        : undefined
                    }
                    id="professional-specialty"
                    required
                    minLength={2}
                    maxLength={120}
                    disabled={isSaving}
                    placeholder="Ex.: Clínica Médica"
                  />
                )}
              />
              <FormFieldError
                id={"professional-specialty-error"}
                message={errors.specialty?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professional-phone">Telefone</Label>

              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.phone}
                    aria-describedby={
                      errors.phone ? "professional-phone-error" : undefined
                    }
                    id="professional-phone"
                    type="tel"
                    maxLength={20}
                    disabled={isSaving}
                    autoComplete="tel"
                  />
                )}
              />
              <FormFieldError
                id={"professional-phone-error"}
                message={errors.phone?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professional-email">E-mail</Label>

              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.email}
                    aria-describedby={
                      errors.email ? "professional-email-error" : undefined
                    }
                    id="professional-email"
                    type="email"
                    maxLength={254}
                    disabled={isSaving}
                    autoComplete="email"
                  />
                )}
              />
              <FormFieldError
                id={"professional-email-error"}
                message={errors.email?.message}
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-medium">Conta de acesso</h3>

            <p className="mt-1 text-sm text-muted-foreground">
              A associação é opcional. Somente contas com vínculo Médico ativo
              nesta clínica podem ser selecionadas.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="professional-user">Conta de usuário</Label>

            <select
              {...register("userId")}
              aria-invalid={!!errors.userId}
              aria-describedby={
                errors.userId ? "professional-user-error" : undefined
              }
              id="professional-user"
              disabled={isSaving}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Nenhuma conta vinculada</option>

              {doctorOptions.map((option) => (
                <option key={option.userId} value={option.userId}>
                  {option.fullName} — {option.email}
                </option>
              ))}
            </select>
            <FormFieldError
              id={"professional-user-error"}
              message={errors.userId?.message}
            />

            {doctorOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Não há contas médicas ativas disponíveis nesta clínica.
              </p>
            ) : null}
          </div>

          <div className="border-t pt-6">
            <h3 className="font-medium">Configuração na clínica</h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Estes dados pertencem somente ao vínculo com a clínica atual.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="professional-local-code">Código local</Label>

              <Controller
                control={control}
                name="localCode"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.localCode}
                    aria-describedby={
                      errors.localCode
                        ? "professional-local-code-error"
                        : undefined
                    }
                    id="professional-local-code"
                    maxLength={60}
                    disabled={isSaving}
                    placeholder="Ex.: MED-001"
                  />
                )}
              />
              <FormFieldError
                id={"professional-local-code-error"}
                message={errors.localCode?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professional-duration">
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
                        ? "professional-duration-error"
                        : undefined
                    }
                    id="professional-duration"
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
                id={"professional-duration-error"}
                message={errors.defaultAppointmentDurationMinutes?.message}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-3 text-sm">
                <input
                  {...register("acceptsAppointments")}
                  id={"professionalFormSchema-acceptsAppointments"}
                  aria-invalid={!!errors.acceptsAppointments}
                  aria-describedby={
                    errors.acceptsAppointments
                      ? "professionalFormSchema-acceptsAppointments-error"
                      : undefined
                  }
                  type="checkbox"
                  disabled={isSaving}
                />
                <FormFieldError
                  id={"professionalFormSchema-acceptsAppointments-error"}
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
              {isSaving ? "Cadastrando..." : "Cadastrar profissional"}
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
