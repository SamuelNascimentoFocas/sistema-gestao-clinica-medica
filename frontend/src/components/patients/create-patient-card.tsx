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

  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60_000,
  );

  return localDate.toISOString().slice(0, 10);
}

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

  return "Não foi possível cadastrar o paciente";
}

export function CreatePatientCard({
  clinicId,
  onCreated,
}: CreatePatientCardProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);

  const [formValues, setFormValues] =
    useState<PatientFormValues>({
      ...EMPTY_PATIENT_FORM,
    });

  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const [successMessage, setSuccessMessage] = useState<
    string | null
  >(null);

  function updateField(
    field: keyof PatientFormValues,
    value: string,
  ) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setFormValues({
      ...EMPTY_PATIENT_FORM,
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

    try {
      const response = await fetch(
        `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formValues),
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
        (await response.json()) as PatientLinkResponse;

      onCreated(body.patientLink);

      resetForm();
      setIsOpen(false);
      setSuccessMessage(
        "Paciente cadastrado e vinculado à clínica.",
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
            <CardTitle>Cadastro de pacientes</CardTitle>

            <CardDescription>
              Cadastre um novo paciente ou vincule à
              clínica um paciente global já existente.
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
        <CardTitle>Novo paciente</CardTitle>

        <CardDescription>
          Nome completo e data de nascimento são
          obrigatórios. Os demais campos podem ser
          preenchidos conforme a disponibilidade.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          className="space-y-6"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="patient-full-name">
                Nome completo
              </Label>

              <Input
                id="patient-full-name"
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
              <Label htmlFor="patient-birth-date">
                Data de nascimento
              </Label>

              <Input
                id="patient-birth-date"
                type="date"
                required
                max={getLocalToday()}
                disabled={isSaving}
                value={formValues.birthDate}
                onChange={(event) =>
                  updateField(
                    "birthDate",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-cpf">
                CPF
              </Label>

              <Input
                id="patient-cpf"
                inputMode="numeric"
                maxLength={11}
                disabled={isSaving}
                value={formValues.cpf}
                placeholder="Somente 11 números"
                onChange={(event) =>
                  updateField(
                    "cpf",
                    event.target.value.replace(
                      /\D/g,
                      "",
                    ),
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-phone">
                Telefone
              </Label>

              <Input
                id="patient-phone"
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
              <Label htmlFor="patient-email">
                E-mail
              </Label>

              <Input
                id="patient-email"
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

            <div className="space-y-2">
              <Label htmlFor="patient-record-number">
                Número do prontuário local
              </Label>

              <Input
                id="patient-record-number"
                maxLength={60}
                disabled={isSaving}
                value={formValues.localRecordNumber}
                placeholder="Ex.: PAC-001"
                onChange={(event) =>
                  updateField(
                    "localRecordNumber",
                    event.target.value,
                  )
                }
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
              <Label htmlFor="patient-address-street">
                Logradouro
              </Label>

              <Input
                id="patient-address-street"
                maxLength={180}
                disabled={isSaving}
                value={formValues.addressStreet}
                autoComplete="address-line1"
                onChange={(event) =>
                  updateField(
                    "addressStreet",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-address-number">
                Número
              </Label>

              <Input
                id="patient-address-number"
                maxLength={30}
                disabled={isSaving}
                value={formValues.addressNumber}
                onChange={(event) =>
                  updateField(
                    "addressNumber",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-address-complement">
                Complemento
              </Label>

              <Input
                id="patient-address-complement"
                maxLength={120}
                disabled={isSaving}
                value={formValues.addressComplement}
                autoComplete="address-line2"
                onChange={(event) =>
                  updateField(
                    "addressComplement",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-neighborhood">
                Bairro
              </Label>

              <Input
                id="patient-neighborhood"
                maxLength={120}
                disabled={isSaving}
                value={formValues.addressNeighborhood}
                onChange={(event) =>
                  updateField(
                    "addressNeighborhood",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-city">
                Cidade
              </Label>

              <Input
                id="patient-city"
                maxLength={120}
                disabled={isSaving}
                value={formValues.addressCity}
                autoComplete="address-level2"
                onChange={(event) =>
                  updateField(
                    "addressCity",
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-state">
                Estado
              </Label>

              <Input
                id="patient-state"
                maxLength={2}
                disabled={isSaving}
                value={formValues.addressState}
                placeholder="MG"
                autoComplete="address-level1"
                onChange={(event) =>
                  updateField(
                    "addressState",
                    event.target.value
                      .replace(/[^A-Za-z]/g, "")
                      .toUpperCase(),
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-postal-code">
                CEP
              </Label>

              <Input
                id="patient-postal-code"
                inputMode="numeric"
                maxLength={8}
                disabled={isSaving}
                value={formValues.addressPostalCode}
                placeholder="Somente 8 números"
                autoComplete="postal-code"
                onChange={(event) =>
                  updateField(
                    "addressPostalCode",
                    event.target.value.replace(
                      /\D/g,
                      "",
                    ),
                  )
                }
              />
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
                : "Cadastrar paciente"}
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