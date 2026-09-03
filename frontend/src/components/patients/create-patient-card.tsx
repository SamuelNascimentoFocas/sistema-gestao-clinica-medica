"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { patientFormSchema } from "@/lib/forms/form-schemas";
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
  EMPTY_PATIENT_FORM,
  type PatientClinicLink,
  type PatientFormValues,
  type PatientLinkResponse,
} from "@/types/patient";

type CreatePatientCardProps = {
  clinicId: string;
  onCreated: (patientLink: PatientClinicLink) => void;
};

function getLocalToday() {
  const now = new Date();

  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 10);
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

  return "Não foi possível cadastrar o paciente";
}

export function CreatePatientCard({
  clinicId,
  onCreated,
}: CreatePatientCardProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);

  const {
    control,
    reset,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema(getLocalToday())),
    defaultValues: {
      ...EMPTY_PATIENT_FORM,
    },
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function resetForm() {
    reset({
      ...EMPTY_PATIENT_FORM,
    });

    setErrorMessage(null);
  }

  function closeForm() {
    resetForm();
    setIsOpen(false);
  }

  async function handleSubmit(formValues: PatientFormValues) {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(clinicId)}/patients`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify(formValues),
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

      const body = (await readBrowserJson(response)) as PatientLinkResponse;

      onCreated(body.patientLink);

      resetForm();
      setIsOpen(false);
      setSuccessMessage("Paciente cadastrado e vinculado à clínica.");
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor");
    }
  }

  if (!isOpen) {
    return (
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Cadastro de pacientes</CardTitle>

            <CardDescription>
              Cadastre um novo paciente ou vincule à clínica um paciente global
              já existente.
            </CardDescription>
          </div>

          <Button
            type="button"
            onClick={() => {
              setSuccessMessage(null);
              setIsOpen(true);
            }}
          >
            Novo paciente
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
        <CardTitle>Novo paciente</CardTitle>

        <CardDescription>
          Nome completo e data de nascimento são obrigatórios. Os demais campos
          podem ser preenchidos conforme a disponibilidade.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-6" onSubmit={submitForm(handleSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="patient-full-name">Nome completo</Label>

              <Controller
                control={control}
                name="fullName"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.fullName}
                    aria-describedby={
                      errors.fullName ? "patient-full-name-error" : undefined
                    }
                    id="patient-full-name"
                    required
                    minLength={3}
                    maxLength={180}
                    disabled={isSaving}
                    autoComplete="name"
                  />
                )}
              />
              <FormFieldError
                id={"patient-full-name-error"}
                message={errors.fullName?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-birth-date">Data de nascimento</Label>

              <Controller
                control={control}
                name="birthDate"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.birthDate}
                    aria-describedby={
                      errors.birthDate ? "patient-birth-date-error" : undefined
                    }
                    id="patient-birth-date"
                    type="date"
                    required
                    max={getLocalToday()}
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={"patient-birth-date-error"}
                message={errors.birthDate?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-cpf">CPF</Label>

              <Controller
                control={control}
                name="cpf"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.cpf}
                    aria-describedby={
                      errors.cpf ? "patient-cpf-error" : undefined
                    }
                    onChange={(event) =>
                      field.onChange(event.target.value.replace(/\D/g, ""))
                    }
                    id="patient-cpf"
                    inputMode="numeric"
                    maxLength={11}
                    disabled={isSaving}
                    placeholder="Somente 11 números"
                  />
                )}
              />
              <FormFieldError
                id={"patient-cpf-error"}
                message={errors.cpf?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-phone">Telefone</Label>

              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.phone}
                    aria-describedby={
                      errors.phone ? "patient-phone-error" : undefined
                    }
                    id="patient-phone"
                    type="tel"
                    maxLength={20}
                    disabled={isSaving}
                    autoComplete="tel"
                  />
                )}
              />
              <FormFieldError
                id={"patient-phone-error"}
                message={errors.phone?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-email">E-mail</Label>

              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.email}
                    aria-describedby={
                      errors.email ? "patient-email-error" : undefined
                    }
                    id="patient-email"
                    type="email"
                    maxLength={254}
                    disabled={isSaving}
                    autoComplete="email"
                  />
                )}
              />
              <FormFieldError
                id={"patient-email-error"}
                message={errors.email?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-record-number">
                Número do prontuário local
              </Label>

              <Controller
                control={control}
                name="localRecordNumber"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.localRecordNumber}
                    aria-describedby={
                      errors.localRecordNumber
                        ? "patient-record-number-error"
                        : undefined
                    }
                    id="patient-record-number"
                    maxLength={60}
                    disabled={isSaving}
                    placeholder="Ex.: PAC-001"
                  />
                )}
              />
              <FormFieldError
                id={"patient-record-number-error"}
                message={errors.localRecordNumber?.message}
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-medium">Endereço</h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Todos os campos de endereço são opcionais.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="patient-address-street">Logradouro</Label>

              <Controller
                control={control}
                name="addressStreet"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.addressStreet}
                    aria-describedby={
                      errors.addressStreet
                        ? "patient-address-street-error"
                        : undefined
                    }
                    id="patient-address-street"
                    maxLength={180}
                    disabled={isSaving}
                    autoComplete="address-line1"
                  />
                )}
              />
              <FormFieldError
                id={"patient-address-street-error"}
                message={errors.addressStreet?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-address-number">Número</Label>

              <Controller
                control={control}
                name="addressNumber"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.addressNumber}
                    aria-describedby={
                      errors.addressNumber
                        ? "patient-address-number-error"
                        : undefined
                    }
                    id="patient-address-number"
                    maxLength={30}
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={"patient-address-number-error"}
                message={errors.addressNumber?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-address-complement">Complemento</Label>

              <Controller
                control={control}
                name="addressComplement"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.addressComplement}
                    aria-describedby={
                      errors.addressComplement
                        ? "patient-address-complement-error"
                        : undefined
                    }
                    id="patient-address-complement"
                    maxLength={120}
                    disabled={isSaving}
                    autoComplete="address-line2"
                  />
                )}
              />
              <FormFieldError
                id={"patient-address-complement-error"}
                message={errors.addressComplement?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-neighborhood">Bairro</Label>

              <Controller
                control={control}
                name="addressNeighborhood"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.addressNeighborhood}
                    aria-describedby={
                      errors.addressNeighborhood
                        ? "patient-neighborhood-error"
                        : undefined
                    }
                    id="patient-neighborhood"
                    maxLength={120}
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={"patient-neighborhood-error"}
                message={errors.addressNeighborhood?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-city">Cidade</Label>

              <Controller
                control={control}
                name="addressCity"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.addressCity}
                    aria-describedby={
                      errors.addressCity ? "patient-city-error" : undefined
                    }
                    id="patient-city"
                    maxLength={120}
                    disabled={isSaving}
                    autoComplete="address-level2"
                  />
                )}
              />
              <FormFieldError
                id={"patient-city-error"}
                message={errors.addressCity?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-state">Estado</Label>

              <Controller
                control={control}
                name="addressState"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.addressState}
                    aria-describedby={
                      errors.addressState ? "patient-state-error" : undefined
                    }
                    onChange={(event) =>
                      field.onChange(
                        event.target.value
                          .replace(/[^A-Za-z]/g, "")
                          .toUpperCase(),
                      )
                    }
                    id="patient-state"
                    maxLength={2}
                    disabled={isSaving}
                    placeholder="MG"
                    autoComplete="address-level1"
                  />
                )}
              />
              <FormFieldError
                id={"patient-state-error"}
                message={errors.addressState?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-postal-code">CEP</Label>

              <Controller
                control={control}
                name="addressPostalCode"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.addressPostalCode}
                    aria-describedby={
                      errors.addressPostalCode
                        ? "patient-postal-code-error"
                        : undefined
                    }
                    onChange={(event) =>
                      field.onChange(event.target.value.replace(/\D/g, ""))
                    }
                    id="patient-postal-code"
                    inputMode="numeric"
                    maxLength={8}
                    disabled={isSaving}
                    placeholder="Somente 8 números"
                    autoComplete="postal-code"
                  />
                )}
              />
              <FormFieldError
                id={"patient-postal-code-error"}
                message={errors.addressPostalCode?.message}
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
              {isSaving ? "Cadastrando..." : "Cadastrar paciente"}
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
