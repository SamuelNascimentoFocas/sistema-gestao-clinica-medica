"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  medicalRecordAccessFormSchema,
  type MedicalRecordAccessFormValues,
} from "@/lib/forms/form-schemas";
import { FormFieldError } from "@/components/ui/form-field-error";

import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { PatientClinicLink } from "@/types/patient";
import {
  MEDICAL_RECORD_ACCESS_PURPOSE_OPTIONS,
  getMedicalRecordEntryTypeLabel,
  type MedicalRecordTimelineResponse,
} from "@/types/medical-record";
import { MedicalRecordAttachmentsPanel } from "@/components/medical-records/medical-record-attachments-panel";
import { MedicalRecordCorrectionForm } from "@/components/medical-records/medical-record-correction-form";
import { MedicalRecordEntryForm } from "@/components/medical-records/medical-record-entry-form";

type MedicalRecordsManagerProps = {
  clinicId: string;
  clinicTimezone: string;
  patients: PatientClinicLink[];
  canCreateEntries: boolean;
  canCorrectEntries: boolean;
  canReadAttachments: boolean;
  canUploadAttachments: boolean;
};

function formatBirthDate(value: string) {
  const dateOnly = value.slice(0, 10);
  const [year, month, day] = dateOnly.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string, timezone: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

async function readResponseMessage(response: BrowserResponse) {
  const body: unknown = await readBrowserJson(response).catch(() => null);

  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return "Não foi possível concluir a operação";
}

export function MedicalRecordsManager({
  clinicId,
  clinicTimezone,
  patients,
  canCreateEntries,
  canCorrectEntries,
  canReadAttachments,
  canUploadAttachments,
}: MedicalRecordsManagerProps) {
  const router = useRouter();

  const {
    register,
    control,
    handleSubmit: submitForm,
    formState: { errors, isSubmitting: isAccessing },
  } = useForm<MedicalRecordAccessFormValues>({
    resolver: zodResolver(medicalRecordAccessFormSchema),
    defaultValues: {
      selectedPatientId: "",
      purposeCode: "patient_care",
      purposeNote: "",
    },
  });
  const [selectedPatientId, purposeCode, purposeNote] = useWatch({
    control,
    name: ["selectedPatientId", "purposeCode", "purposeNote"],
  });

  const [timeline, setTimeline] =
    useState<MedicalRecordTimelineResponse | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [correctingEntryId, setCorrectingEntryId] = useState<string | null>(
    null,
  );

  const selectedPatientLink = useMemo(
    () =>
      patients.find(
        (patientLink) => patientLink.patient.id === selectedPatientId,
      ) ?? null,
    [patients, selectedPatientId],
  );

  function clearLoadedTimeline() {
    setTimeline(null);
    setErrorMessage(null);
    setCorrectingEntryId(null);
  }

  async function loadTimeline(
    patientId: string,
    page = 1,
    preserveTimeline = false,
  ) {
    const normalizedPurposeNote = purposeNote.trim();

    setIsLoading(true);
    setErrorMessage(null);

    if (!preserveTimeline) {
      setTimeline(null);
    }

    try {
      const response = await browserApi.request<string>({
        url: `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/patients/${encodeURIComponent(patientId)}/medical-record/access`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          purposeCode,
          purposeNote: normalizedPurposeNote || null,
          page,
          perPage: 20,
        }),
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();

        return;
      }

      if (!isSuccessfulResponse(response)) {
        setErrorMessage(await readResponseMessage(response));

        return;
      }

      const body = (await readBrowserJson(
        response,
      )) as MedicalRecordTimelineResponse;

      setTimeline(body);
    } catch {
      setErrorMessage("Não foi possível comunicar com o servidor.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAccess() {
    if (!selectedPatientLink) {
      setErrorMessage("Selecione um paciente para acessar o prontuário.");

      return;
    }

    await loadTimeline(selectedPatientLink.patient.id, 1);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Acessar prontuário</CardTitle>

          <CardDescription>
            Selecione o paciente e informe a finalidade. O acesso será
            registrado para fins de auditoria.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-5" onSubmit={submitForm(handleAccess)}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="medical-record-patient">Paciente</Label>

                <select
                  {...register("selectedPatientId", {
                    onChange: () => {
                      clearLoadedTimeline();
                    },
                  })}
                  aria-invalid={!!errors.selectedPatientId}
                  aria-describedby={
                    errors.selectedPatientId
                      ? "medical-record-patient-error"
                      : undefined
                  }
                  id="medical-record-patient"
                  disabled={isLoading}
                  required
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Selecione um paciente</option>

                  {patients.map((patientLink) => (
                    <option key={patientLink.id} value={patientLink.patient.id}>
                      {patientLink.patient.fullName}
                      {patientLink.localRecordNumber
                        ? ` · ${patientLink.localRecordNumber}`
                        : ""}
                    </option>
                  ))}
                </select>
                <FormFieldError
                  id={"medical-record-patient-error"}
                  message={errors.selectedPatientId?.message}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="medical-record-purpose">
                  Finalidade do acesso
                </Label>

                <select
                  {...register("purposeCode", {
                    onChange: () => {
                      clearLoadedTimeline();
                    },
                  })}
                  aria-invalid={!!errors.purposeCode}
                  aria-describedby={
                    errors.purposeCode
                      ? "medical-record-purpose-error"
                      : undefined
                  }
                  id="medical-record-purpose"
                  disabled={isLoading}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {MEDICAL_RECORD_ACCESS_PURPOSE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <FormFieldError
                  id={"medical-record-purpose-error"}
                  message={errors.purposeCode?.message}
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {
                MEDICAL_RECORD_ACCESS_PURPOSE_OPTIONS.find(
                  (option) => option.value === purposeCode,
                )?.description
              }
            </p>

            {purposeCode === "other" ? (
              <div className="space-y-2">
                <Label htmlFor="medical-record-purpose-note">
                  Detalhamento da finalidade
                </Label>

                <textarea
                  {...register("purposeNote", {
                    onChange: () => {
                      clearLoadedTimeline();
                    },
                  })}
                  aria-invalid={!!errors.purposeNote}
                  aria-describedby={
                    errors.purposeNote
                      ? "medical-record-purpose-note-error"
                      : undefined
                  }
                  id="medical-record-purpose-note"
                  required
                  maxLength={500}
                  disabled={isLoading}
                  rows={4}
                  className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Descreva por que o acesso ao prontuário é necessário."
                />
                <FormFieldError
                  id={"medical-record-purpose-note-error"}
                  message={errors.purposeNote?.message}
                />

                <p className="text-xs text-muted-foreground">
                  {purposeNote.length}/500 caracteres
                </p>
              </div>
            ) : null}

            {errorMessage ? (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={isLoading || isAccessing || !selectedPatientId}
            >
              {isLoading ? "Carregando prontuário..." : "Acessar prontuário"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {timeline ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{timeline.patient.fullName}</CardTitle>

              <CardDescription>
                Nascimento: {formatBirthDate(timeline.patient.birthDate)}
                {" · "}
                Prontuário local:{" "}
                {timeline.patientLink.localRecordNumber ?? "não informado"}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <p className="text-sm text-muted-foreground">
                {timeline.meta.total === 1
                  ? "1 entrada clínica registrada."
                  : `${timeline.meta.total} entradas clínicas registradas.`}
              </p>
            </CardContent>
          </Card>

          {canCreateEntries ? (
            <MedicalRecordEntryForm
              clinicId={clinicId}
              patientId={timeline.patient.id}
              onCreated={() => loadTimeline(timeline.patient.id, 1, true)}
            />
          ) : null}

          {timeline.entries.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="font-medium">Nenhuma entrada clínica</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  O prontuário ainda não possui registros clínicos.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {timeline.entries.map((entry) => (
                <Card key={entry.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {getMedicalRecordEntryTypeLabel(entry.entryTypeCode)}
                        </CardTitle>

                        <CardDescription>
                          {entry.clinicProfessional?.professional.fullName ??
                            entry.authorUser?.fullName ??
                            "Profissional não informado"}
                          {" · "}
                          {entry.clinic?.name ?? "Clínica não informada"}
                        </CardDescription>
                      </div>

                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(entry.createdAt, clinicTimezone)}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-6">
                      {entry.content}
                    </p>

                    {entry.correctsEntryId ? (
                      <p className="mt-4 text-xs text-muted-foreground">
                        Esta entrada corrige um registro clínico anterior.
                      </p>
                    ) : null}

                    {canCorrectEntries &&
                    entry.clinicId === clinicId &&
                    entry.corrections.length === 0 ? (
                      <div className="mt-4">
                        {correctingEntryId === entry.id ? (
                          <MedicalRecordCorrectionForm
                            clinicId={clinicId}
                            patientId={timeline.patient.id}
                            entryId={entry.id}
                            onCorrected={async () => {
                              setCorrectingEntryId(null);
                              await loadTimeline(timeline.patient.id, 1, true);
                            }}
                            onCancel={() => {
                              setCorrectingEntryId(null);
                            }}
                          />
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setCorrectingEntryId(entry.id);
                            }}
                          >
                            Registrar correção
                          </Button>
                        )}
                      </div>
                    ) : null}

                    {canCorrectEntries &&
                    entry.clinicId === clinicId &&
                    entry.corrections.length > 0 ? (
                      <p className="mt-4 text-xs text-muted-foreground">
                        Esta entrada já possui uma correção direta. Para
                        continuar a cadeia, utilize a entrada corrigida mais
                        recente.
                      </p>
                    ) : null}

                    {canReadAttachments ? (
                      <MedicalRecordAttachmentsPanel
                        clinicId={clinicId}
                        patientId={timeline.patient.id}
                        entryId={entry.id}
                        clinicTimezone={clinicTimezone}
                        accessValues={{
                          purposeCode,
                          purposeNote,
                        }}
                        canUploadAttachments={
                          canUploadAttachments && entry.clinicId === clinicId
                        }
                      />
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {timeline.meta.lastPage > 1 ? (
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isLoading || timeline.meta.currentPage <= 1}
                onClick={() => {
                  void loadTimeline(
                    timeline.patient.id,
                    timeline.meta.currentPage - 1,
                    true,
                  );
                }}
              >
                Anterior
              </Button>

              <span className="text-sm text-muted-foreground">
                Página {timeline.meta.currentPage} de {timeline.meta.lastPage}
              </span>

              <Button
                type="button"
                variant="outline"
                disabled={
                  isLoading ||
                  timeline.meta.currentPage >= timeline.meta.lastPage
                }
                onClick={() => {
                  void loadTimeline(
                    timeline.patient.id,
                    timeline.meta.currentPage + 1,
                    true,
                  );
                }}
              >
                Próxima
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
