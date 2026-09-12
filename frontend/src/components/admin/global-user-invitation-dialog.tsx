"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useState } from "react";
import { GlobalUserMembershipRow } from "@/components/admin/global-user-membership-row";
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
  parseGlobalUserInvitationPayload,
  parseGlobalUserResponse,
} from "@/lib/admin/global-admin-contract";
import {
  globalUserInvitationFormSchema,
  type GlobalUserInvitationFormValues,
} from "@/lib/admin/global-admin-user-schemas";
import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
} from "@/lib/client/browser-api";
import type { ClinicMemberUser } from "@/types/administration";

type GlobalUserInvitationDialogProps = {
  onSuccess: (user: ClinicMemberUser) => void;
};

const INITIAL_VALUES: GlobalUserInvitationFormValues = {
  fullName: "",
  email: "",
  memberships: [],
};

function responseMessage(value: unknown, fallback: string) {
  return typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message
    : fallback;
}

export function GlobalUserInvitationDialog({
  onSuccess,
}: GlobalUserInvitationDialogProps) {
  const [open, setOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    control,
    register,
    reset,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GlobalUserInvitationFormValues>({
    resolver: zodResolver(globalUserInvitationFormSchema),
    defaultValues: INITIAL_VALUES,
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "memberships",
  });
  const memberships =
    useWatch({ control, name: "memberships" }) ?? INITIAL_VALUES.memberships;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) return;
    setRequestError(null);
    reset(INITIAL_VALUES);
    setOpen(nextOpen);
  }

  async function submit(values: GlobalUserInvitationFormValues) {
    setRequestError(null);
    const parsedPayload = parseGlobalUserInvitationPayload(values);
    if (!parsedPayload.ok) {
      setRequestError(parsedPayload.message);
      return;
    }

    try {
      const response = await browserApi.request<string>({
        url: "/api/admin/users",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(parsedPayload.value),
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const body = await readBrowserJson(response).catch(() => null);
      if (!isSuccessfulResponse(response)) {
        throw new Error(responseMessage(body, "Não foi possível convidar o usuário."));
      }
      const parsedResponse = parseGlobalUserResponse(body);
      if (!parsedResponse) throw new Error("O servidor retornou um usuário inválido.");

      onSuccess(parsedResponse.user);
      reset(INITIAL_VALUES);
      setOpen(false);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Não foi possível convidar o usuário.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" />}>Convidar usuário</DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!isSubmitting}
      >
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>
            O usuário receberá um convite por e-mail e definirá a própria senha.
            Vínculos iniciais são opcionais.
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
            <div className="space-y-2">
              <Label htmlFor="global-user-full-name">Nome completo</Label>
              <Input
                {...register("fullName")}
                id="global-user-full-name"
                autoComplete="name"
                maxLength={180}
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? "global-user-full-name-error" : undefined}
              />
              <FormFieldError
                id="global-user-full-name-error"
                message={errors.fullName?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="global-user-email">E-mail</Label>
              <Input
                {...register("email")}
                id="global-user-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "global-user-email-error" : undefined}
              />
              <FormFieldError
                id="global-user-email-error"
                message={errors.email?.message}
              />
            </div>
          </div>

          <fieldset className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <legend className="text-sm font-medium">Vínculos iniciais</legend>
                <p className="text-xs text-muted-foreground">
                  Cada vínculo seleciona um consultório e um perfil atribuído por UUID.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => append({ clinicId: "", roleId: "" })}
              >
                Adicionar vínculo
              </Button>
            </div>

            {fields.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhum vínculo inicial. O usuário poderá ser vinculado posteriormente.
              </p>
            ) : null}

            {fields.map((field, index) => (
              <GlobalUserMembershipRow
                key={field.id}
                index={index}
                clinicId={memberships[index]?.clinicId ?? ""}
                roleId={memberships[index]?.roleId ?? ""}
                selectedClinicIds={memberships
                  .filter((_, membershipIndex) => membershipIndex !== index)
                  .map((membership) => membership.clinicId)
                  .filter(Boolean)}
                disabled={isSubmitting}
                clinicError={errors.memberships?.[index]?.clinicId?.message}
                roleError={errors.memberships?.[index]?.roleId?.message}
                onClinicChange={(clinicId) =>
                  setValue(`memberships.${index}.clinicId`, clinicId, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                onRoleChange={(roleId) =>
                  setValue(`memberships.${index}.roleId`, roleId, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                onRemove={() => remove(index)}
              />
            ))}
          </fieldset>

          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" disabled={isSubmitting} />}
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enviando convite..." : "Enviar convite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
