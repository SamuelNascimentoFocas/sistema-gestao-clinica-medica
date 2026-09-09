"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useEffect, useState, type ReactNode } from "react";
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
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
} from "@/lib/client/browser-api";
import {
  customRoleFormSchema,
  type CustomRoleFormValues,
} from "@/lib/forms/form-schemas";
import {
  customRoleInputToPayload,
  parseClinicRoleResponse,
} from "@/lib/administration/role-contract";
import type { ClinicRole, ClinicRolePermission } from "@/types/administration";

type ClinicRoleFormDialogProps = {
  clinicId: string;
  permissions: ClinicRolePermission[];
  role?: ClinicRole;
  trigger: ReactNode;
  onSuccess: (role: ClinicRole) => void;
};

function valuesFor(role?: ClinicRole): CustomRoleFormValues {
  return {
    name: role?.name ?? "",
    description: role?.description ?? "",
    permissionCodes: role?.permissions.map((permission) => permission.code) ?? [],
  };
}

function responseMessage(body: unknown, fallback: string) {
  return typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
    ? body.message
    : fallback;
}

export function ClinicRoleFormDialog({
  clinicId,
  permissions,
  role,
  trigger,
  onSuccess,
}: ClinicRoleFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const isEdit = role !== undefined;
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomRoleFormValues>({
    resolver: zodResolver(customRoleFormSchema),
    defaultValues: valuesFor(role),
  });

  useEffect(() => {
    reset(valuesFor(role));
  }, [reset, role]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) return;
    reset(valuesFor(role));
    setRequestError(null);
    setOpen(nextOpen);
  }

  async function submit(values: CustomRoleFormValues) {
    setRequestError(null);

    const url = role
      ? `/api/clinics/${encodeURIComponent(clinicId)}/roles/${encodeURIComponent(role.id)}`
      : `/api/clinics/${encodeURIComponent(clinicId)}/roles`;

    try {
      const response = await browserApi.request<string>({
        url,
        method: role ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(customRoleInputToPayload(values)),
      });

      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }

      const body: unknown = await readBrowserJson(response).catch(() => null);

      if (!isSuccessfulResponse(response)) {
        throw new Error(
          responseMessage(body, `Não foi possível ${isEdit ? "atualizar" : "criar"} o perfil.`),
        );
      }

      const savedRole = parseClinicRoleResponse(body);
      if (!savedRole) throw new Error("O servidor retornou um perfil inválido.");

      onSuccess(savedRole);
      reset(valuesFor(savedRole));
      setOpen(false);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Não foi possível salvar o perfil.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90vh] overflow-y-auto" showCloseButton={!isSubmitting}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar perfil personalizado" : "Novo perfil personalizado"}</DialogTitle>
          <DialogDescription>
            Selecione somente as permissões necessárias. O backend valida escopo e delegação.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit(submit)}>
          {requestError ? (
            <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {requestError}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`role-name-${role?.id ?? "new"}`}>Nome</Label>
            <Input
              {...register("name")}
              id={`role-name-${role?.id ?? "new"}`}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? `role-name-error-${role?.id ?? "new"}` : undefined}
              maxLength={120}
              autoComplete="off"
            />
            <FormFieldError id={`role-name-error-${role?.id ?? "new"}`} message={errors.name?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`role-description-${role?.id ?? "new"}`}>Descrição</Label>
            <textarea
              {...register("description")}
              id={`role-description-${role?.id ?? "new"}`}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? `role-description-error-${role?.id ?? "new"}` : undefined}
              maxLength={255}
              rows={3}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <FormFieldError id={`role-description-error-${role?.id ?? "new"}`} message={errors.description?.message} />
          </div>

          <Controller
            control={control}
            name="permissionCodes"
            render={({ field }) => (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Permissões</legend>
                {permissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma permissão configurável disponível.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {permissions.map((permission) => {
                      const checked = field.value.includes(permission.code);
                      return (
                        <label key={permission.id} className="flex gap-3 rounded-lg border p-3 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              field.onChange(
                                event.target.checked
                                  ? [...field.value, permission.code]
                                  : field.value.filter((code) => code !== permission.code),
                              );
                            }}
                          />
                          <span>
                            <span className="block font-medium">{permission.description}</span>
                            <code className="text-xs text-muted-foreground">{permission.code}</code>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            )}
          />

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={isSubmitting} />}>Cancelar</DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar perfil"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
