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
  patientLinkToForm,
  type PatientClinicLink,
  type PatientFormValues,
  type PatientLinkResponse,
} from "@/types/patient";

type EditPatientCardProps = {
  clinicId: string;
  patientLink: PatientClinicLink;
  onUpdated: (patientLink: PatientClinicLink) => void;
  onCancel: () => void;
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

  return "Não foi possível atualizar o paciente";
}

export function EditPatientCard({
  clinicId,
  patientLink,
  onUpdated,
  onCancel,
}: EditPatientCardProps) {
  const router = useRouter();

  const {
    control,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema(getLocalToday())),
    defaultValues: patientLinkToForm(patientLink),
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(formValues: PatientFormValues) {
    setErrorMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients/${encodeURIComponent(patientLink.patient.id)}`,
        method: "PATCH",
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

      onUpdated(body.patientLink);
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar {patientLink.patient.fullName}</CardTitle>

        <CardDescription>
          Atualize os dados do paciente e as informações específicas do vínculo
          com esta clínica.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-6" onSubmit={submitForm(handleSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-patient-full-name">Nome completo</Label>

              <Controller
                control={control}
                name="fullName"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.fullName}
                    aria-describedby={
                      errors.fullName
                        ? "edit-patient-full-name-error"
                        : undefined
                    }
                    id="edit-patient-full-name"
                    required
                    minLength={3}
                    maxLength={180}
                    disabled={isSaving}
                    autoComplete="name"
                  />
                )}
              />
              <FormFieldError
                id={"edit-patient-full-name-error"}
                message={errors.fullName?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-patient-birth-date">
                Data de nascimento
              </Label>

              <Controller
                control={control}
                name="birthDate"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.birthDate}
                    aria-describedby={
                      errors.birthDate
                        ? "edit-patient-birth-date-error"
                        : undefined
                    }
                    id="edit-patient-birth-date"
                    type="date"
                    required
                    max={getLocalToday()}
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={"edit-patient-birth-date-error"}
                message={errors.birthDate?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-patient-cpf">CPF</Label>

              <Controller
                control={control}
                name="cpf"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.cpf}
                    aria-describedby={
                      errors.cpf ? "edit-patient-cpf-error" : undefined
                    }
                    onChange={(event) =>
                      field.onChange(event.target.value.replace(/\D/g, ""))
                    }
                    id="edit-patient-cpf"
                    inputMode="numeric"
                    maxLength={11}
                    disabled={isSaving}
                    placeholder="Somente 11 números"
                  />
                )}
              />
              <FormFieldError
                id={"edit-patient-cpf-error"}
                message={errors.cpf?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-patient-phone">Telefone</Label>

              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.phone}
                    aria-describedby={
                      errors.phone ? "edit-patient-phone-error" : undefined
                    }
                    id="edit-patient-phone"
                    type="tel"
                    maxLength={20}
                    disabled={isSaving}
                    autoComplete="tel"
                  />
                )}
              />
              <FormFieldError
                id={"edit-patient-phone-error"}
                message={errors.phone?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-patient-email">E-mail</Label>

              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.email}
                    aria-describedby={
                      errors.email ? "edit-patient-email-error" : undefined
                    }
                    id="edit-patient-email"
                    type="email"
                    maxLength={254}
                    disabled={isSaving}
                    autoComplete="email"
                  />
                )}
              />
              <FormFieldError
                id={"edit-patient-email-error"}
                message={errors.email?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-patient-record">
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
                        ? "edit-patient-record-error"
                        : undefined
                    }
                    id="edit-patient-record"
                    maxLength={60}
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={"edit-patient-record-error"}
                message={errors.localRecordNumber?.message}
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-medium">Endereço</h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Campos deixados vazios serão removidos do cadastro.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-patient-street">Logradouro</Label>

              <Controller
                control={control}
                name="addressStreet"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.addressStreet}
                    aria-describedby={
                      errors.addressStreet
                        ? "edit-patient-street-error"
                        : undefined
                    }
                    id="edit-patient-street"
                    maxLength={180}
                    disabled={isSaving}
                    autoComplete="address-line1"
                  />
                )}
              />
              <FormFieldError
                id={"edit-patient-street-error"}
                message={errors.addressStreet?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-patient-number">Número</Label>

              <Controller
                control={control}
                name="addressNumber"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.addressNumber}
                    aria-describedby={
                      errors.addressNumber
                        ? "edit-patient-number-error"
                        : undefined
                    }
                    id="edit-patient-number"
                    maxLength={30}
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={"edit-patient-number-error"}
                message={errors.addressNumber?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-patient-complement">Complemento</Label>

              <Controller
                control={control}
                name="addressComplement"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.addressComplement}
                    aria-describedby={
                      errors.addressComplement
                        ? "edit-patient-complement-error"
                        : undefined
                    }
                    id="edit-patient-complement"
                    maxLength={120}
                    disabled={isSaving}
                    autoComplete="address-line2"
                  />
                )}
              />
              <FormFieldError
                id={"edit-patient-complement-error"}
                message={errors.addressComplement?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-patient-neighborhood">Bairro</Label>

              <Controller
                control={control}
                name="addressNeighborhood"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.addressNeighborhood}
                    aria-describedby={
                      errors.addressNeighborhood
                        ? "edit-patient-neighborhood-error"
                        : undefined
                    }
                    id="edit-patient-neighborhood"
                    maxLength={120}
                    disabled={isSaving}
                  />
                )}
              />
              <FormFieldError
                id={"edit-patient-neighborhood-error"}
                message={errors.addressNeighborhood?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-patient-city">Cidade</Label>

              <Controller
                control={control}
                name="addressCity"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.addressCity}
                    aria-describedby={
                      errors.addressCity ? "edit-patient-city-error" : undefined
                    }
                    id="edit-patient-city"
                    maxLength={120}
                    disabled={isSaving}
                    autoComplete="address-level2"
                  />
                )}
              />
              <FormFieldError
                id={"edit-patient-city-error"}
                message={errors.addressCity?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-patient-state">Estado</Label>

              <Controller
                control={control}
                name="addressState"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.addressState}
                    aria-describedby={
                      errors.addressState
                        ? "edit-patient-state-error"
                        : undefined
                    }
                    onChange={(event) =>
                      field.onChange(
                        event.target.value
                          .replace(/[^A-Za-z]/g, "")
                          .toUpperCase(),
                      )
                    }
                    id="edit-patient-state"
                    maxLength={2}
                    disabled={isSaving}
                    placeholder="MG"
                    autoComplete="address-level1"
                  />
                )}
              />
              <FormFieldError
                id={"edit-patient-state-error"}
                message={errors.addressState?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-patient-postal-code">CEP</Label>

              <Controller
                control={control}
                name="addressPostalCode"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-invalid={!!errors.addressPostalCode}
                    aria-describedby={
                      errors.addressPostalCode
                        ? "edit-patient-postal-code-error"
                        : undefined
                    }
                    onChange={(event) =>
                      field.onChange(event.target.value.replace(/\D/g, ""))
                    }
                    id="edit-patient-postal-code"
                    inputMode="numeric"
                    maxLength={8}
                    disabled={isSaving}
                    placeholder="Somente 8 números"
                    autoComplete="postal-code"
                  />
                )}
              />
              <FormFieldError
                id={"edit-patient-postal-code-error"}
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
