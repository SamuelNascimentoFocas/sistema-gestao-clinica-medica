"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormFieldError } from "@/components/ui/form-field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  globalClinicFormSchema,
  globalClinicFormValues,
  globalClinicPayload,
  type GlobalClinicFormValues,
} from "@/lib/admin/global-admin-clinic-schemas";
import {
  parseGlobalClinicCreatePayload,
  parseGlobalClinicResponse,
  parseGlobalClinicUpdatePayload,
} from "@/lib/admin/global-admin-contract";
import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
} from "@/lib/client/browser-api";
import type { Clinic } from "@/types/clinic";

type GlobalClinicFormDialogProps = {
  clinic?: Clinic;
  disabled?: boolean;
  onSuccess: (clinic: Clinic) => void;
};

function responseMessage(value: unknown, fallback: string) {
  return typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message
    : fallback;
}

export function GlobalClinicFormDialog({
  clinic,
  disabled = false,
  onSuccess,
}: GlobalClinicFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const isEditing = clinic !== undefined;
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GlobalClinicFormValues>({
    resolver: zodResolver(globalClinicFormSchema),
    defaultValues: globalClinicFormValues(clinic),
  });

  useEffect(() => {
    reset(globalClinicFormValues(clinic));
  }, [clinic, reset]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) return;
    setRequestError(null);
    reset(globalClinicFormValues(clinic));
    setOpen(nextOpen);
  }

  async function submit(values: GlobalClinicFormValues) {
    setRequestError(null);
    const candidate = globalClinicPayload(values);
    const payload = isEditing
      ? parseGlobalClinicUpdatePayload(candidate)
      : parseGlobalClinicCreatePayload(candidate);

    if (!payload.ok) {
      setRequestError(payload.message);
      return;
    }

    try {
      const response = await browserApi.request<string>({
        url: isEditing
          ? "/api/admin/clinics/" + encodeURIComponent(clinic.id)
          : "/api/admin/clinics",
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(payload.value),
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }

      const body = await readBrowserJson(response).catch(() => null);
      if (!isSuccessfulResponse(response)) {
        throw new Error(
          responseMessage(
            body,
            isEditing
              ? "Não foi possível atualizar a clínica."
              : "Não foi possível cadastrar a clínica.",
          ),
        );
      }

      const parsed = parseGlobalClinicResponse(body);
      if (!parsed) throw new Error("O servidor retornou uma clínica inválida.");

      onSuccess(parsed.clinic);
      reset(globalClinicFormValues(parsed.clinic));
      setOpen(false);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a clínica.",
      );
    }
  }

  const fields: ReadonlyArray<{
    name: keyof GlobalClinicFormValues;
    label: string;
    maximum: number;
    required?: boolean;
    inputMode?: "numeric" | "tel";
  }> = [
    { name: "name", label: "Nome", maximum: 180, required: true },
    { name: "cnpj", label: "CNPJ", maximum: 14, inputMode: "numeric" },
    { name: "phone", label: "Telefone", maximum: 20, inputMode: "tel" },
    { name: "addressStreet", label: "Logradouro", maximum: 180 },
    { name: "addressNumber", label: "Número", maximum: 30 },
    { name: "addressComplement", label: "Complemento", maximum: 120 },
    { name: "addressNeighborhood", label: "Bairro", maximum: 120 },
    { name: "addressCity", label: "Cidade", maximum: 120 },
    { name: "addressState", label: "UF", maximum: 2 },
    {
      name: "addressPostalCode",
      label: "CEP",
      maximum: 8,
      inputMode: "numeric",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant={isEditing ? "outline" : "default"} disabled={disabled} />
        }
      >
        {isEditing ? "Editar" : "Cadastrar clínica"}
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!isSubmitting}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar clínica" : "Cadastrar clínica"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize os dados cadastrais sem alterar vínculos ou perfis."
              : "Cadastre somente a clínica. Usuários e vínculos são geridos separadamente."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit(submit)}>
          {requestError ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {requestError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const error = errors[field.name]?.message;
              const inputId = `global-clinic-${field.name}-${clinic?.id ?? "new"}`;

              return (
                <div
                  key={field.name}
                  className={field.name === "name" || field.name === "addressStreet" ? "space-y-2 sm:col-span-2" : "space-y-2"}
                >
                  <Label htmlFor={inputId}>{field.label}</Label>
                  <Input
                    {...register(field.name)}
                    id={inputId}
                    maxLength={field.maximum}
                    inputMode={field.inputMode}
                    required={field.required}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                  />
                  <FormFieldError id={`${inputId}-error`} message={error} />
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" disabled={isSubmitting} />}
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar clínica"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
