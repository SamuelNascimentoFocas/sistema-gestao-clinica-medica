"use client";

import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";

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

  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60_000,
  );

  return localDate.toISOString().slice(0, 10);
}

async function readResponseMessage(response: BrowserResponse) {
  const body: unknown = await readBrowserJson(response)
    .catch(() => null);

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

  const [formValues, setFormValues] =
    useState<PatientFormValues>(() =>
      patientLinkToForm(patientLink),
    );

  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState<
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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients/${encodeURIComponent(
          patientLink.patient.id,
        )}`,
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
        setErrorMessage(
          await readResponseMessage(response),
        );

        return;
      }

      const body =
        (await readBrowserJson(response)) as PatientLinkResponse;

      onUpdated(body.patientLink);
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Editar {patientLink.patient.fullName}
        </CardTitle>

        <CardDescription>
          Atualize os dados do paciente e as informações
          específicas do vínculo com esta clínica.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          className="space-y-6"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-patient-full-name">
                Nome completo
              </Label>

              <Input
                id="edit-patient-full-name"
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
              <Label htmlFor="edit-patient-birth-date">
                Data de nascimento
              </Label>

              <Input
                id="edit-patient-birth-date"
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
              <Label htmlFor="edit-patient-cpf">
                CPF
              </Label>

              <Input
                id="edit-patient-cpf"
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
              <Label htmlFor="edit-patient-phone">
                Telefone
              </Label>

              <Input
                id="edit-patient-phone"
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
              <Label htmlFor="edit-patient-email">
                E-mail
              </Label>

              <Input
                id="edit-patient-email"
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
              <Label htmlFor="edit-patient-record">
                Número do prontuário local
              </Label>

              <Input
                id="edit-patient-record"
                maxLength={60}
                disabled={isSaving}
                value={formValues.localRecordNumber}
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
              Campos deixados vazios serão removidos do
              cadastro.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-patient-street">
                Logradouro
              </Label>

              <Input
                id="edit-patient-street"
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
              <Label htmlFor="edit-patient-number">
                Número
              </Label>

              <Input
                id="edit-patient-number"
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
              <Label htmlFor="edit-patient-complement">
                Complemento
              </Label>

              <Input
                id="edit-patient-complement"
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
              <Label htmlFor="edit-patient-neighborhood">
                Bairro
              </Label>

              <Input
                id="edit-patient-neighborhood"
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
              <Label htmlFor="edit-patient-city">
                Cidade
              </Label>

              <Input
                id="edit-patient-city"
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
              <Label htmlFor="edit-patient-state">
                Estado
              </Label>

              <Input
                id="edit-patient-state"
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
              <Label htmlFor="edit-patient-postal-code">
                CEP
              </Label>

              <Input
                id="edit-patient-postal-code"
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
                ? "Salvando..."
                : "Salvar alterações"}
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
