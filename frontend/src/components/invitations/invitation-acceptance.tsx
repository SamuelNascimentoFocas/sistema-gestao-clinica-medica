"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormFieldError } from "@/components/ui/form-field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
} from "@/lib/client/browser-api";
import {
  invitationPasswordFormSchema,
  type InvitationPasswordFormValues,
} from "@/lib/forms/form-schemas";
import {
  parseInvitationValidationResponse,
  takeInvitationTokenFromFragment,
} from "@/lib/invitations/invitation-contract";

type InvitationPageState =
  | "validating"
  | "valid"
  | "invalid-or-unavailable"
  | "submitting"
  | "success"
  | "safe-error";

const DEFAULT_VALUES: InvitationPasswordFormValues = {
  password: "",
  passwordConfirmation: "",
};

export function InvitationAcceptance() {
  const tokenRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);
  const [state, setState] = useState<InvitationPageState>("validating");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    control,
    handleSubmit: submitForm,
    reset,
    formState: { errors },
  } = useForm<InvitationPasswordFormValues>({
    resolver: zodResolver(invitationPasswordFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    const controller = new AbortController();
    const capturedToken =
      tokenRef.current ??
      takeInvitationTokenFromFragment(window.location, window.history);

    tokenRef.current = capturedToken;
    setToken(capturedToken);

    if (!capturedToken) {
      setState("invalid-or-unavailable");
      return () => controller.abort();
    }

    async function validateInvitation() {
      try {
        const response = await browserApi.request<string>({
          url: "/api/invitations/validate",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          data: JSON.stringify({ token: capturedToken }),
          signal: controller.signal,
        });

        if (!isSuccessfulResponse(response)) {
          tokenRef.current = null;
          setToken(null);
          setState("invalid-or-unavailable");
          return;
        }

        const body = await readBrowserJson(response).catch(() => null);
        if (parseInvitationValidationResponse(body)) {
          setValidated(true);
          setState("valid");
        } else {
          tokenRef.current = null;
          setToken(null);
          setState("invalid-or-unavailable");
        }
      } catch {
        if (!controller.signal.aborted) {
          tokenRef.current = null;
          setToken(null);
          setErrorMessage("Não foi possível validar o convite. Tente novamente.");
          setState("safe-error");
        }
      }
    }

    void validateInvitation();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (state === "success") {
      tokenRef.current = null;
    }
  }, [state]);

  async function handleAccept(values: InvitationPasswordFormValues) {
    if (!token) {
      setState("invalid-or-unavailable");
      return;
    }

    setState("submitting");
    setErrorMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: "/api/invitations/accept",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ token, ...values }),
      });

      if (!isSuccessfulResponse(response)) {
        setErrorMessage(
          response.status === 422
            ? "Não foi possível aceitar o convite. Verifique os dados ou solicite um novo convite."
            : "Não foi possível aceitar o convite. Tente novamente.",
        );
        setState("safe-error");
        return;
      }

      setToken(null);
      reset(DEFAULT_VALUES);
      setState("success");
    } catch {
      setErrorMessage("Não foi possível aceitar o convite. Tente novamente.");
      setState("safe-error");
    }
  }

  const formVisible =
    state === "valid" ||
    state === "submitting" ||
    (state === "safe-error" && validated);
  const isSubmitting = state === "submitting";

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-2">
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
            CM
          </div>
          <CardTitle className="text-2xl">Defina sua senha</CardTitle>
          <CardDescription>
            Conclua o convite para acessar o Sistema de Gestão de Clínica Médica.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {state === "validating" ? (
            <p role="status" className="text-sm text-muted-foreground">
              Validando convite...
            </p>
          ) : null}

          {state === "invalid-or-unavailable" ? (
            <div role="alert" className="space-y-4">
              <p className="text-sm">
                Este convite está indisponível. Solicite um novo convite ao administrador.
              </p>
              <Link className={buttonVariants({ variant: "outline" })} href="/login">
                Ir para o login
              </Link>
            </div>
          ) : null}

          {formVisible ? (
            <form className="space-y-5" onSubmit={submitForm(handleAccept)}>
              <div className="space-y-2">
                <Label htmlFor="invitation-password">Nova senha</Label>
                <Controller
                  control={control}
                  name="password"
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="invitation-password"
                      type="password"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? "invitation-password-error" : undefined}
                      required
                    />
                  )}
                />
                <FormFieldError id="invitation-password-error" message={errors.password?.message} />
                <p className="text-xs text-muted-foreground">
                  Use ao menos 12 caracteres e no máximo 72 bytes.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invitation-password-confirmation">Confirmar senha</Label>
                <Controller
                  control={control}
                  name="passwordConfirmation"
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="invitation-password-confirmation"
                      type="password"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      aria-invalid={!!errors.passwordConfirmation}
                      aria-describedby={
                        errors.passwordConfirmation
                          ? "invitation-password-confirmation-error"
                          : undefined
                      }
                      required
                    />
                  )}
                />
                <FormFieldError
                  id="invitation-password-confirmation-error"
                  message={errors.passwordConfirmation?.message}
                />
              </div>

              {errorMessage ? (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorMessage}
                </div>
              ) : null}

              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Definindo senha..." : "Definir senha"}
              </Button>
            </form>
          ) : null}

          {state === "safe-error" && !formVisible && errorMessage ? (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          {state === "success" ? (
            <div role="status" className="space-y-4">
              <p className="text-sm">
                Sua senha foi definida com sucesso. Use o login normal para acessar o sistema.
              </p>
              <Link className={buttonVariants()} href="/login">
                Ir para o login
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
