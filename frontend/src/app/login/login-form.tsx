"use client";

import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
} from "@/lib/client/browser-api";

import { type FormEvent, useState } from "react";
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

type LoginErrorResponse = {
  message?: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await browserApi.request<string>({
        url: "/api/auth/login",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        data: JSON.stringify({
          email,
          password,
        }),
      });

      const body = (await readBrowserJson(response).catch(() => null)) as
        | LoginErrorResponse
        | null;

      if (!isSuccessfulResponse(response)) {
        setErrorMessage(
          body?.message ?? "Não foi possível entrar no sistema.",
        );
        return;
      }

      router.replace("/clinics");
      router.refresh();
    } catch {
      setErrorMessage(
        "Não foi possível conectar ao servidor. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-2">
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
            CM
          </div>

          <CardTitle className="text-2xl">Acesso ao sistema</CardTitle>

          <CardDescription>
            Informe suas credenciais para acessar a gestão da clínica.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>

              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>

              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {errorMessage ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {errorMessage}
              </div>
            ) : null}

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
