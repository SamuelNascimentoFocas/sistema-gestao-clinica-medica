"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormFieldError } from "@/components/ui/form-field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";
import { patientFormSchema } from "@/lib/forms/form-schemas";
import {
  EMPTY_PATIENT_FORM,
  patientLinkToForm,
  type PatientClinicLink,
  type PatientFormValues,
  type PatientLinkResponse,
} from "@/types/patient";

type PatientFormProps = {
  clinicId: string;
  patientLink?: PatientClinicLink;
  onSuccess: (patientLink: PatientClinicLink) => void;
  onCancel: () => void;
};

const PATIENT_FIELD_IDS = {
  create: {
    fullName: "patient-full-name",
    birthDate: "patient-birth-date",
    cpf: "patient-cpf",
    phone: "patient-phone",
    email: "patient-email",
    localRecordNumber: "patient-record-number",
    addressStreet: "patient-address-street",
    addressNumber: "patient-address-number",
    addressComplement: "patient-address-complement",
    addressNeighborhood: "patient-neighborhood",
    addressCity: "patient-city",
    addressState: "patient-state",
    addressPostalCode: "patient-postal-code",
  },
  edit: {
    fullName: "edit-patient-full-name",
    birthDate: "edit-patient-birth-date",
    cpf: "edit-patient-cpf",
    phone: "edit-patient-phone",
    email: "edit-patient-email",
    localRecordNumber: "edit-patient-record",
    addressStreet: "edit-patient-street",
    addressNumber: "edit-patient-number",
    addressComplement: "edit-patient-complement",
    addressNeighborhood: "edit-patient-neighborhood",
    addressCity: "edit-patient-city",
    addressState: "edit-patient-state",
    addressPostalCode: "edit-patient-postal-code",
  },
} as const;

function getLocalToday() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 10);
}

async function readResponseMessage(
  response: BrowserResponse,
  fallback: string,
) {
  const body: unknown = await readBrowserJson(response).catch(() => null);

  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return fallback;
}

export function PatientForm({
  clinicId,
  patientLink,
  onSuccess,
  onCancel,
}: PatientFormProps) {
  const router = useRouter();
  const isEdit = patientLink !== undefined;
  const mode = isEdit ? "edit" : "create";
  const fieldIds = PATIENT_FIELD_IDS[mode];
  const initialValues = isEdit
    ? patientLinkToForm(patientLink)
    : { ...EMPTY_PATIENT_FORM };

  const {
    control,
    reset,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema(getLocalToday())),
    defaultValues: initialValues,
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleCancel() {
    reset(initialValues);
    setErrorMessage(null);
    onCancel();
  }

  async function handleSubmit(formValues: PatientFormValues) {
    setErrorMessage(null);

    const requestUrl = patientLink
      ? `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients/${encodeURIComponent(patientLink.patient.id)}`
      : `/api/clinics/${encodeURIComponent(clinicId)}/patients`;

    try {
      const response = await browserApi.request<string>({
        url: requestUrl,
        method: isEdit ? "PATCH" : "POST",
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
        setErrorMessage(
          await readResponseMessage(
            response,
            isEdit
              ? "Não foi possível atualizar o paciente"
              : "Não foi possível cadastrar o paciente",
          ),
        );

        return;
      }

      const body = (await readBrowserJson(response)) as PatientLinkResponse;

      onSuccess(body.patientLink);

      if (!isEdit) {
        reset({ ...EMPTY_PATIENT_FORM });
      }
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor");
    }
  }

  return (
    <form className="space-y-6" onSubmit={submitForm(handleSubmit)}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={fieldIds.fullName}>Nome completo</Label>
          <Controller
            control={control}
            name="fullName"
            render={({ field }) => (
              <Input
                {...field}
                aria-invalid={!!errors.fullName}
                aria-describedby={
                  errors.fullName ? `${fieldIds.fullName}-error` : undefined
                }
                id={fieldIds.fullName}
                required
                minLength={3}
                maxLength={180}
                disabled={isSaving}
                autoComplete="name"
              />
            )}
          />
          <FormFieldError
            id={`${fieldIds.fullName}-error`}
            message={errors.fullName?.message}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldIds.birthDate}>Data de nascimento</Label>
          <Controller
            control={control}
            name="birthDate"
            render={({ field }) => (
              <Input
                {...field}
                aria-invalid={!!errors.birthDate}
                aria-describedby={
                  errors.birthDate ? `${fieldIds.birthDate}-error` : undefined
                }
                id={fieldIds.birthDate}
                type="date"
                required
                max={getLocalToday()}
                disabled={isSaving}
              />
            )}
          />
          <FormFieldError
            id={`${fieldIds.birthDate}-error`}
            message={errors.birthDate?.message}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldIds.cpf}>CPF</Label>
          <Controller
            control={control}
            name="cpf"
            render={({ field }) => (
              <Input
                {...field}
                aria-invalid={!!errors.cpf}
                aria-describedby={
                  errors.cpf ? `${fieldIds.cpf}-error` : undefined
                }
                onChange={(event) =>
                  field.onChange(event.target.value.replace(/\D/g, ""))
                }
                id={fieldIds.cpf}
                inputMode="numeric"
                maxLength={11}
                disabled={isSaving}
                placeholder="Somente 11 números"
              />
            )}
          />
          <FormFieldError
            id={`${fieldIds.cpf}-error`}
            message={errors.cpf?.message}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldIds.phone}>Telefone</Label>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <Input
                {...field}
                aria-invalid={!!errors.phone}
                aria-describedby={
                  errors.phone ? `${fieldIds.phone}-error` : undefined
                }
                id={fieldIds.phone}
                type="tel"
                maxLength={20}
                disabled={isSaving}
                autoComplete="tel"
              />
            )}
          />
          <FormFieldError
            id={`${fieldIds.phone}-error`}
            message={errors.phone?.message}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldIds.email}>E-mail</Label>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <Input
                {...field}
                aria-invalid={!!errors.email}
                aria-describedby={
                  errors.email ? `${fieldIds.email}-error` : undefined
                }
                id={fieldIds.email}
                type="email"
                maxLength={254}
                disabled={isSaving}
                autoComplete="email"
              />
            )}
          />
          <FormFieldError
            id={`${fieldIds.email}-error`}
            message={errors.email?.message}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldIds.localRecordNumber}>
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
                    ? `${fieldIds.localRecordNumber}-error`
                    : undefined
                }
                id={fieldIds.localRecordNumber}
                maxLength={60}
                disabled={isSaving}
                placeholder={isEdit ? undefined : "Ex.: PAC-001"}
              />
            )}
          />
          <FormFieldError
            id={`${fieldIds.localRecordNumber}-error`}
            message={errors.localRecordNumber?.message}
          />
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="font-medium">Endereço</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEdit
            ? "Campos deixados vazios serão removidos do cadastro."
            : "Todos os campos de endereço são opcionais."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={fieldIds.addressStreet}>Logradouro</Label>
          <Controller
            control={control}
            name="addressStreet"
            render={({ field }) => (
              <Input
                {...field}
                aria-invalid={!!errors.addressStreet}
                aria-describedby={
                  errors.addressStreet
                    ? `${fieldIds.addressStreet}-error`
                    : undefined
                }
                id={fieldIds.addressStreet}
                maxLength={180}
                disabled={isSaving}
                autoComplete="address-line1"
              />
            )}
          />
          <FormFieldError
            id={`${fieldIds.addressStreet}-error`}
            message={errors.addressStreet?.message}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldIds.addressNumber}>Número</Label>
          <Controller
            control={control}
            name="addressNumber"
            render={({ field }) => (
              <Input
                {...field}
                aria-invalid={!!errors.addressNumber}
                aria-describedby={
                  errors.addressNumber
                    ? `${fieldIds.addressNumber}-error`
                    : undefined
                }
                id={fieldIds.addressNumber}
                maxLength={30}
                disabled={isSaving}
              />
            )}
          />
          <FormFieldError
            id={`${fieldIds.addressNumber}-error`}
            message={errors.addressNumber?.message}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldIds.addressComplement}>Complemento</Label>
          <Controller
            control={control}
            name="addressComplement"
            render={({ field }) => (
              <Input
                {...field}
                aria-invalid={!!errors.addressComplement}
                aria-describedby={
                  errors.addressComplement
                    ? `${fieldIds.addressComplement}-error`
                    : undefined
                }
                id={fieldIds.addressComplement}
                maxLength={120}
                disabled={isSaving}
                autoComplete="address-line2"
              />
            )}
          />
          <FormFieldError
            id={`${fieldIds.addressComplement}-error`}
            message={errors.addressComplement?.message}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldIds.addressNeighborhood}>Bairro</Label>
          <Controller
            control={control}
            name="addressNeighborhood"
            render={({ field }) => (
              <Input
                {...field}
                aria-invalid={!!errors.addressNeighborhood}
                aria-describedby={
                  errors.addressNeighborhood
                    ? `${fieldIds.addressNeighborhood}-error`
                    : undefined
                }
                id={fieldIds.addressNeighborhood}
                maxLength={120}
                disabled={isSaving}
              />
            )}
          />
          <FormFieldError
            id={`${fieldIds.addressNeighborhood}-error`}
            message={errors.addressNeighborhood?.message}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldIds.addressCity}>Cidade</Label>
          <Controller
            control={control}
            name="addressCity"
            render={({ field }) => (
              <Input
                {...field}
                aria-invalid={!!errors.addressCity}
                aria-describedby={
                  errors.addressCity
                    ? `${fieldIds.addressCity}-error`
                    : undefined
                }
                id={fieldIds.addressCity}
                maxLength={120}
                disabled={isSaving}
                autoComplete="address-level2"
              />
            )}
          />
          <FormFieldError
            id={`${fieldIds.addressCity}-error`}
            message={errors.addressCity?.message}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldIds.addressState}>Estado</Label>
          <Controller
            control={control}
            name="addressState"
            render={({ field }) => (
              <Input
                {...field}
                aria-invalid={!!errors.addressState}
                aria-describedby={
                  errors.addressState
                    ? `${fieldIds.addressState}-error`
                    : undefined
                }
                onChange={(event) =>
                  field.onChange(
                    event.target.value
                      .replace(/[^A-Za-z]/g, "")
                      .toUpperCase(),
                  )
                }
                id={fieldIds.addressState}
                maxLength={2}
                disabled={isSaving}
                placeholder="MG"
                autoComplete="address-level1"
              />
            )}
          />
          <FormFieldError
            id={`${fieldIds.addressState}-error`}
            message={errors.addressState?.message}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldIds.addressPostalCode}>CEP</Label>
          <Controller
            control={control}
            name="addressPostalCode"
            render={({ field }) => (
              <Input
                {...field}
                aria-invalid={!!errors.addressPostalCode}
                aria-describedby={
                  errors.addressPostalCode
                    ? `${fieldIds.addressPostalCode}-error`
                    : undefined
                }
                onChange={(event) =>
                  field.onChange(event.target.value.replace(/\D/g, ""))
                }
                id={fieldIds.addressPostalCode}
                inputMode="numeric"
                maxLength={8}
                disabled={isSaving}
                placeholder="Somente 8 números"
                autoComplete="postal-code"
              />
            )}
          />
          <FormFieldError
            id={`${fieldIds.addressPostalCode}-error`}
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
          {isEdit
            ? isSaving
              ? "Salvando..."
              : "Salvar alterações"
            : isSaving
              ? "Cadastrando..."
              : "Cadastrar paciente"}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={isSaving}
          onClick={handleCancel}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
