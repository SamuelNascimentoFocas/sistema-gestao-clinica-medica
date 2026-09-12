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
  parseGlobalUserResponse,
  parseGlobalUserUpdatePayload,
} from "@/lib/admin/global-admin-contract";
import {
  globalUserEditFormSchema,
  type GlobalUserEditFormValues,
} from "@/lib/admin/global-admin-user-schemas";
import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
} from "@/lib/client/browser-api";
import type { ClinicMemberUser } from "@/types/administration";

type GlobalUserEditDialogProps = {
  user: ClinicMemberUser;
  disabled: boolean;
  onSuccess: (user: ClinicMemberUser) => void;
};

function valuesFor(user: ClinicMemberUser): GlobalUserEditFormValues {
  return { fullName: user.fullName, email: user.email };
}

function responseMessage(value: unknown, fallback: string) {
  return typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message
    : fallback;
}

export function GlobalUserEditDialog({
  user,
  disabled,
  onSuccess,
}: GlobalUserEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GlobalUserEditFormValues>({
    resolver: zodResolver(globalUserEditFormSchema),
    defaultValues: valuesFor(user),
  });

  useEffect(() => {
    reset(valuesFor(user));
  }, [reset, user]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) return;
    setRequestError(null);
    reset(valuesFor(user));
    setOpen(nextOpen);
  }

  async function submit(values: GlobalUserEditFormValues) {
    setRequestError(null);
    const payload = parseGlobalUserUpdatePayload(values);
    if (!payload.ok) {
      setRequestError(payload.message);
      return;
    }

    try {
      const response = await browserApi.request<string>({
        url: "/api/admin/users/" + encodeURIComponent(user.id),
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(payload.value),
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const body = await readBrowserJson(response).catch(() => null);
      if (!isSuccessfulResponse(response)) {
        throw new Error(responseMessage(body, "Não foi possível atualizar o usuário."));
      }
      const parsed = parseGlobalUserResponse(body);
      if (!parsed) throw new Error("O servidor retornou um usuário inválido.");

      onSuccess(parsed.user);
      reset(valuesFor(parsed.user));
      setOpen(false);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o usuário.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" disabled={disabled} />}>
        Editar
      </DialogTrigger>
      <DialogContent showCloseButton={!isSubmitting}>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>
            Atualize somente os dados de identificação. Senhas e autoridade global não são
            administráveis nesta interface.
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

          <div className="space-y-2">
            <Label htmlFor={`global-user-edit-name-${user.id}`}>Nome completo</Label>
            <Input
              {...register("fullName")}
              id={`global-user-edit-name-${user.id}`}
              autoComplete="name"
              maxLength={180}
              aria-invalid={!!errors.fullName}
              aria-describedby={
                errors.fullName ? `global-user-edit-name-error-${user.id}` : undefined
              }
            />
            <FormFieldError
              id={`global-user-edit-name-error-${user.id}`}
              message={errors.fullName?.message}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`global-user-edit-email-${user.id}`}>E-mail</Label>
            <Input
              {...register("email")}
              id={`global-user-edit-email-${user.id}`}
              type="email"
              autoComplete="email"
              maxLength={254}
              aria-invalid={!!errors.email}
              aria-describedby={
                errors.email ? `global-user-edit-email-error-${user.id}` : undefined
              }
            />
            <FormFieldError
              id={`global-user-edit-email-error-${user.id}`}
              message={errors.email?.message}
            />
          </div>

          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" disabled={isSubmitting} />}
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar usuário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
