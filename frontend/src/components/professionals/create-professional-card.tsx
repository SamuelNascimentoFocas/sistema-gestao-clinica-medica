"use client";

import { FormEvent, useState } from "react";
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
  onCreated: (
    professionalLink: ClinicProfessionalLink,
  ) => void;
};

async function readResponseMessage(response: Response) {
  const body: unknown = await response
    .json()
    .catch(() => null);

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

  const [formValues, setFormValues] =
    useState<CreateProfessionalFormValues>({
      ...EMPTY_PROFESSIONAL_FORM,
    });

  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const [successMessage, setSuccessMessage] = useState<
    string | null
  >(null);

  function updateField(
    field: keyof CreateProfessionalFormValues,
    value: string | boolean,
  ) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setFormValues({
      ...EMPTY_PROFESSIONAL_FORM,
    });

    setErrorMessage(null);
  }

  function closeForm() {
    resetForm();
    setIsOpen(false);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const duration = Number(
      formValues.defaultAppointmentDurationMinutes,
    );

    try {
      const response = await fetch(
        `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: formValues.fullName,
            crmNumber: formValues.crmNumber,
            crmState: formValues.crmState,
            specialty: formValues.specialty,
            phone: formValues.phone,
            email: formValues.email,
            userId: formValues.userId || null,
            localCode: formValues.localCode,
            defaultAppointmentDurationMinutes:
              duration,
            acceptsAppointments:
              formValues.acceptsAppointments,
          }),
        },
      );

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();

        return;
      }

      if (!response.ok) {
        setErrorMessage(
          await readResponseMessage(response),
        );

        return;
      }

      const body =
        (await response.json()) as ProfessionalLinkResponse;

      onCreated(body.professionalLink);

      resetForm();
      setIsOpen(false);
      setSuccessMessage(
        "Profissional cadastrado e vinculado à clínica.",
      );
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) {
    return (
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>
              Cadastro de profissionais
            </CardTitle>

            <CardDescription>
              Cadastre um profissional e configure seu
              vínculo de atendimento com a clínica.
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
            <p
              className="text-sm font-medium text-emerald-700"
              role="status"
            >
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
          Informe os dados profissionais e as configurações
          específicas desta clínica.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          className="space-y-6"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="professional-full-name">
                Nome completo
              </Label>

              <Input
                id="professional-full-name"
                required
                minLength={3}
                maxLength={180}
                disabled={isSaving}
                value={formValues.fullName}
                autoComplete="name"
                onChange={(event) =>
                  updateField(
                    "fullName",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professional-crm-number">
                Número do CRM
              </Label>

              <Input
                id="professional-crm-number"
                required
                minLength={1}
                maxLength={30}
                disabled={isSaving}
                value={formValues.crmNumber}
                placeholder="Ex.: 12345"
                onChange={(event) =>
                  updateField(
                    "crmNumber",
                    event.target.value.toUpperCase(),
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professional-crm-state">
                UF do CRM
              </Label>

              <Input
                id="professional-crm-state"
                required
                minLength={2}
                maxLength={2}
                disabled={isSaving}
                value={formValues.crmState}
                placeholder="MG"
                onChange={(event) =>
                  updateField(
                    "crmState",
                    event.target.value
                      .replace(/[^A-Za-z]/g, "")
                      .toUpperCase(),
                  )
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="professional-specialty">
                Especialidade
              </Label>

              <Input
                id="professional-specialty"
                required
                minLength={2}
                maxLength={120}
                disabled={isSaving}
                value={formValues.specialty}
                placeholder="Ex.: Clínica Médica"
                onChange={(event) =>
                  updateField(
                    "specialty",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professional-phone">
                Telefone
              </Label>

              <Input
                id="professional-phone"
                type="tel"
                maxLength={20}
                disabled={isSaving}
                value={formValues.phone}
                autoComplete="tel"
                onChange={(event) =>
                  updateField(
                    "phone",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professional-email">
                E-mail
              </Label>

              <Input
                id="professional-email"
                type="email"
                maxLength={254}
                disabled={isSaving}
                value={formValues.email}
                autoComplete="email"
                onChange={(event) =>
                  updateField(
                    "email",
                    event.target.value,
                  )
                }
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-medium">
              Conta de acesso
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              A associação é opcional. Somente contas com
              vínculo Médico ativo nesta clínica podem ser
              selecionadas.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="professional-user">
              Conta de usuário
            </Label>

            <select
              id="professional-user"
              value={formValues.userId}
              disabled={isSaving}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) =>
                updateField(
                  "userId",
                  event.target.value,
                )
              }
            >
              <option value="">
                Nenhuma conta vinculada
              </option>

              {doctorOptions.map((option) => (
                <option
                  key={option.userId}
                  value={option.userId}
                >
                  {option.fullName} — {option.email}
                </option>
              ))}
            </select>

            {doctorOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Não há contas médicas ativas disponíveis
                nesta clínica.
              </p>
            ) : null}
          </div>

          <div className="border-t pt-6">
            <h3 className="font-medium">
              Configuração na clínica
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Estes dados pertencem somente ao vínculo com
              a clínica atual.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="professional-local-code">
                Código local
              </Label>

              <Input
                id="professional-local-code"
                maxLength={60}
                disabled={isSaving}
                value={formValues.localCode}
                placeholder="Ex.: MED-001"
                onChange={(event) =>
                  updateField(
                    "localCode",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professional-duration">
                Duração padrão da consulta
              </Label>

              <Input
                id="professional-duration"
                type="number"
                required
                min={5}
                max={480}
                step={1}
                disabled={isSaving}
                value={
                  formValues.defaultAppointmentDurationMinutes
                }
                onChange={(event) =>
                  updateField(
                    "defaultAppointmentDurationMinutes",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={
                    formValues.acceptsAppointments
                  }
                  disabled={isSaving}
                  onChange={(event) =>
                    updateField(
                      "acceptsAppointments",
                      event.target.checked,
                    )
                  }
                />

                <span>
                  Este profissional aceita agendamentos
                </span>
              </label>
            </div>
          </div>

          {errorMessage ? (
            <p
              className="text-sm text-destructive"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={isSaving}
            >
              {isSaving
                ? "Cadastrando..."
                : "Cadastrar profissional"}
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