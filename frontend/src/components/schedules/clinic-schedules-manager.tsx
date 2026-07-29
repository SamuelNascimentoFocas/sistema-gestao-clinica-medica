"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type {
  ClinicProfessionalLink,
  ProfessionalWeeklyAvailability,
  ProfessionalScheduleBlock,
} from "@/types/professional";
import {
  getWeekdayLabel,
  normalizeTimeForInput,
  type ProfessionalSchedule,
  type ProfessionalScheduleResponse,
  type WeeklyAvailabilityResponse,
  type ScheduleBlockResponse,
} from "@/types/schedule";
import { CreateWeeklyAvailabilityCard } from "@/components/schedules/create-weekly-availability-card";
import { Button } from "@/components/ui/button";
import { EditWeeklyAvailabilityCard } from "@/components/schedules/edit-weekly-availability-card";
import { CreateScheduleBlockCard } from "@/components/schedules/create-schedule-block-card";
import { EditScheduleBlockCard } from "@/components/schedules/edit-schedule-block-card";

type ClinicSchedulesManagerProps = {
  clinicId: string;
  clinicTimezone: string;
  professionals: ClinicProfessionalLink[];
  initialProfessionalId: string | null;
  initialSchedule: ProfessionalSchedule | null;
  currentUserId: string;
  canManageAll: boolean;
  canManageOwn: boolean;
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

  return "Não foi possível carregar a agenda";
}

function formatDateTime(
  value: string,
  timezone: string,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "short",
  };

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      ...options,
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(
      "pt-BR",
      options,
    ).format(date);
  }
}

function sortWeeklyAvailabilities(
  availabilities: ProfessionalWeeklyAvailability[],
) {
  return [...availabilities].sort((first, second) => {
    if (first.weekday !== second.weekday) {
      return first.weekday - second.weekday;
    }

    return first.startTime.localeCompare(
      second.startTime,
    );
  });
}

function sortScheduleBlocks(
  scheduleBlocks: ProfessionalScheduleBlock[],
) {
  return [...scheduleBlocks].sort(
    (first, second) =>
      new Date(first.startsAt).getTime() -
      new Date(second.startsAt).getTime(),
  );
}

export function ClinicSchedulesManager({
  clinicId,
  clinicTimezone,
  professionals,
  initialProfessionalId,
  initialSchedule,
  currentUserId,
  canManageAll,
  canManageOwn,
}: ClinicSchedulesManagerProps) {
  const router = useRouter();

  const [
    selectedProfessionalId,
    setSelectedProfessionalId,
  ] = useState(initialProfessionalId ?? "");

  const [schedule, setSchedule] =
    useState<ProfessionalSchedule | null>(
      initialSchedule,
    );

  const [isLoading, setIsLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const [successMessage, setSuccessMessage] = useState<
    string | null
  >(null);

  const [
    editingAvailabilityId,
    setEditingAvailabilityId,
  ] = useState<string | null>(null);

  const [
    statusAvailabilityId,
    setStatusAvailabilityId,
  ] = useState<string | null>(null);

  const [
    editingScheduleBlockId,
    setEditingScheduleBlockId,
  ] = useState<string | null>(null);

  const [
    statusScheduleBlockId,
    setStatusScheduleBlockId,
  ] = useState<string | null>(null);

  const canManageSelectedSchedule =
    schedule !== null &&
    (canManageAll ||
      (canManageOwn &&
        schedule.professional.userId ===
          currentUserId));

  async function handleProfessionalChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    const professionalId = event.target.value;

    setSelectedProfessionalId(professionalId);
    setErrorMessage(null);
    setSuccessMessage(null);
    setEditingAvailabilityId(null);
    setStatusAvailabilityId(null);
    setEditingScheduleBlockId(null);
    setStatusScheduleBlockId(null);

    if (!professionalId) {
      setSchedule(null);

      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals/${encodeURIComponent(
          professionalId,
        )}/schedule`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();

        return;
      }

      if (!response.ok) {
        setSchedule(null);
        setErrorMessage(
          await readResponseMessage(response),
        );

        return;
      }

      const body =
        (await response.json()) as ProfessionalScheduleResponse;

      setSchedule(body.schedule);
    } catch {
      setSchedule(null);
      setErrorMessage(
        "Não foi possível comunicar com o servidor",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleAvailabilityCreated(
    availability: ProfessionalWeeklyAvailability,
  ) {
    setSchedule((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        weeklyAvailabilities:
          sortWeeklyAvailabilities([
            ...current.weeklyAvailabilities.filter(
              (item) => item.id !== availability.id,
            ),
            availability,
          ]),
      };
    });
  }

  function handleAvailabilityUpdated(
    availability: ProfessionalWeeklyAvailability,
  ) {
    setSchedule((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        weeklyAvailabilities:
          sortWeeklyAvailabilities([
            ...current.weeklyAvailabilities.filter(
              (item) => item.id !== availability.id,
            ),
            availability,
          ]),
      };
    });

    setEditingAvailabilityId(null);
    setErrorMessage(null);
    setSuccessMessage(
      "Horário semanal atualizado.",
    );
  }

  async function handleAvailabilityStatusToggle(
    availability: ProfessionalWeeklyAvailability,
  ) {
    if (!schedule) {
      return;
    }

    setStatusAvailabilityId(availability.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals/${encodeURIComponent(
          schedule.professional.id,
        )}/weekly-availabilities/${encodeURIComponent(
          availability.id,
        )}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: !availability.isActive,
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
        (await response.json()) as WeeklyAvailabilityResponse;

      const updatedAvailability = body.availability;

      setSchedule((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          weeklyAvailabilities:
            sortWeeklyAvailabilities(
              current.weeklyAvailabilities.map(
                (item) =>
                  item.id === updatedAvailability.id
                    ? updatedAvailability
                    : item,
              ),
            ),
        };
      });

      setEditingAvailabilityId(null);

      setSuccessMessage(
        updatedAvailability.isActive
          ? "Horário semanal ativado."
          : "Horário semanal inativado.",
      );
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor",
      );
    } finally {
      setStatusAvailabilityId(null);
    }
  }

  function handleScheduleBlockCreated(
    scheduleBlock: ProfessionalScheduleBlock,
  ) {
    setSchedule((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        scheduleBlocks: sortScheduleBlocks([
          ...current.scheduleBlocks.filter(
            (item) => item.id !== scheduleBlock.id,
          ),
          scheduleBlock,
        ]),
      };
    });
  }

  function handleScheduleBlockUpdated(
    scheduleBlock: ProfessionalScheduleBlock,
  ) {
    setSchedule((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        scheduleBlocks: sortScheduleBlocks([
          ...current.scheduleBlocks.filter(
            (item) => item.id !== scheduleBlock.id,
          ),
          scheduleBlock,
        ]),
      };
    });

    setEditingScheduleBlockId(null);
    setErrorMessage(null);
    setSuccessMessage(
      "Bloqueio de agenda atualizado.",
    );
  }

  async function handleScheduleBlockStatusToggle(
    scheduleBlock: ProfessionalScheduleBlock,
  ) {
    if (!schedule) {
      return;
    }

    setStatusScheduleBlockId(scheduleBlock.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/clinics/${encodeURIComponent(
          clinicId,
        )}/professionals/${encodeURIComponent(
          schedule.professional.id,
        )}/schedule-blocks/${encodeURIComponent(
          scheduleBlock.id,
        )}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: !scheduleBlock.isActive,
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
        (await response.json()) as ScheduleBlockResponse;

      const updatedScheduleBlock =
        body.scheduleBlock;

      setSchedule((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          scheduleBlocks: sortScheduleBlocks(
            current.scheduleBlocks.map((item) =>
              item.id === updatedScheduleBlock.id
                ? updatedScheduleBlock
                : item,
            ),
          ),
        };
      });

      setEditingScheduleBlockId(null);

      setSuccessMessage(
        updatedScheduleBlock.isActive
          ? "Bloqueio de agenda ativado."
          : "Bloqueio de agenda inativado.",
      );
    } catch {
      setErrorMessage(
        "Não foi possível comunicar com o servidor",
      );
    } finally {
      setStatusScheduleBlockId(null);
    }
  }

  if (professionals.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="font-medium">
            Nenhum profissional disponível
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre e vincule um profissional antes de
            configurar agendas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Selecionar profissional</CardTitle>

          <CardDescription>
            Escolha um profissional para consultar sua
            disponibilidade semanal e seus bloqueios.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="max-w-xl space-y-2">
            <Label htmlFor="schedule-professional">
              Profissional
            </Label>

            <select
              id="schedule-professional"
              value={selectedProfessionalId}
              disabled={isLoading}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) =>
                void handleProfessionalChange(event)
              }
            >
              <option value="">
                Selecione um profissional
              </option>

              {professionals.map(
                (professionalLink) => (
                  <option
                    key={professionalLink.id}
                    value={
                      professionalLink.professional.id
                    }
                  >
                    {
                      professionalLink.professional
                        .fullName
                    }{" "}
                    — CRM{" "}
                    {
                      professionalLink.professional
                        .crmState
                    }{" "}
                    {
                      professionalLink.professional
                        .crmNumber
                    }
                    {!professionalLink.isActive
                      ? " — vínculo inativo"
                      : ""}
                  </option>
                ),
              )}
            </select>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Carregando agenda...
            </p>
          ) : null}

          {errorMessage ? (
            <p
              className="text-sm text-destructive"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p
              className="text-sm font-medium text-emerald-700"
              role="status"
            >
              {successMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {schedule ? (
        <>
          <Card>
            <CardHeader className="gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>
                    {schedule.professional.fullName}
                  </CardTitle>

                  <CardDescription>
                    CRM {schedule.professional.crmState}{" "}
                    {schedule.professional.crmNumber} ·{" "}
                    {schedule.professional.specialty}
                  </CardDescription>
                </div>

                <span
                  className={
                    canManageSelectedSchedule
                      ? "w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
                      : "w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                  }
                >
                  {canManageSelectedSchedule
                    ? "Agenda administrável"
                    : "Somente leitura"}
                </span>
              </div>
            </CardHeader>

            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">
                    Código local
                  </dt>

                  <dd className="font-medium">
                    {schedule.localCode ??
                      "Não informado"}
                  </dd>
                </div>

                <div>
                  <dt className="text-muted-foreground">
                    Duração padrão
                  </dt>

                  <dd className="font-medium">
                    {
                      schedule.defaultAppointmentDurationMinutes
                    }{" "}
                    minutos
                  </dd>
                </div>

                <div>
                  <dt className="text-muted-foreground">
                    Situação
                  </dt>

                  <dd className="font-medium">
                    {schedule.isActive
                      ? "Vínculo ativo"
                      : "Vínculo inativo"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {canManageSelectedSchedule ? (
            <CreateWeeklyAvailabilityCard
              key={schedule.professional.id}
              clinicId={clinicId}
              professionalId={
                schedule.professional.id
              }
              onCreated={
                handleAvailabilityCreated
              }
            />
          ) : null}

          {canManageSelectedSchedule ? (
            <CreateScheduleBlockCard
              key={`block-${schedule.professional.id}`}
              clinicId={clinicId}
              professionalId={
                schedule.professional.id
              }
              onCreated={
                handleScheduleBlockCreated
              }
            />
          ) : null}

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  Disponibilidade semanal
                </CardTitle>

                <CardDescription>
                  Períodos recorrentes em que o
                  profissional realiza atendimentos.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {schedule.weeklyAvailabilities.length ===
                0 ? (
                  <div className="py-6 text-center">
                    <p className="font-medium">
                      Nenhum horário semanal cadastrado
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      A agenda ainda não possui
                      disponibilidade recorrente.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {schedule.weeklyAvailabilities.map(
                      (availability) => {
                        if (
                          editingAvailabilityId ===
                          availability.id
                        ) {
                          return (
                            <EditWeeklyAvailabilityCard
                              key={availability.id}
                              clinicId={clinicId}
                              professionalId={
                                schedule.professional.id
                              }
                              availability={
                                availability
                              }
                              onUpdated={
                                handleAvailabilityUpdated
                              }
                              onCancel={() =>
                                setEditingAvailabilityId(
                                  null,
                                )
                              }
                            />
                          );
                        }

                        return (
                          <div
                            key={availability.id}
                            className="space-y-3 rounded-md border p-4"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-medium">
                                  {getWeekdayLabel(
                                    availability.weekday,
                                  )}
                                </p>

                                <p className="text-sm text-muted-foreground">
                                  {normalizeTimeForInput(
                                    availability.startTime,
                                  )}{" "}
                                  até{" "}
                                  {normalizeTimeForInput(
                                    availability.endTime,
                                  )}
                                </p>
                              </div>

                              <span
                                className={
                                  availability.isActive
                                    ? "w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
                                    : "w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                                }
                              >
                                {availability.isActive
                                  ? "Ativo"
                                  : "Inativo"}
                              </span>
                            </div>

                            {canManageSelectedSchedule ? (
                              <div className="flex flex-wrap gap-3 border-t pt-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={
                                    statusAvailabilityId !==
                                    null
                                  }
                                  onClick={() => {
                                    setErrorMessage(null);
                                    setSuccessMessage(null);
                                    setEditingAvailabilityId(
                                      availability.id,
                                    );
                                  }}
                                >
                                  Editar horário
                                </Button>

                                <Button
                                  type="button"
                                  variant={
                                    availability.isActive
                                      ? "outline"
                                      : "default"
                                  }
                                  disabled={
                                    statusAvailabilityId !==
                                      null ||
                                    editingAvailabilityId !==
                                      null
                                  }
                                  onClick={() =>
                                    void handleAvailabilityStatusToggle(
                                      availability,
                                    )
                                  }
                                >
                                  {statusAvailabilityId ===
                                  availability.id
                                    ? "Atualizando..."
                                    : availability.isActive
                                      ? "Inativar horário"
                                      : "Ativar horário"}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  Bloqueios de agenda
                </CardTitle>

                <CardDescription>
                  Períodos excepcionais em que o
                  profissional não está disponível.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {schedule.scheduleBlocks.length ===
                0 ? (
                  <div className="py-6 text-center">
                    <p className="font-medium">
                      Nenhum bloqueio cadastrado
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      A agenda não possui indisponibilidades
                      excepcionais.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {schedule.scheduleBlocks.map(
                      (scheduleBlock) => {
                        if (
                          editingScheduleBlockId ===
                          scheduleBlock.id
                        ) {
                          return (
                            <EditScheduleBlockCard
                              key={scheduleBlock.id}
                              clinicId={clinicId}
                              professionalId={
                                schedule.professional.id
                              }
                              scheduleBlock={
                                scheduleBlock
                              }
                              onUpdated={
                                handleScheduleBlockUpdated
                              }
                              onCancel={() =>
                                setEditingScheduleBlockId(
                                  null,
                                )
                              }
                            />
                          );
                        }

                        return (
                          <div
                            key={scheduleBlock.id}
                            className="space-y-3 rounded-md border p-4"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-medium">
                                  {formatDateTime(
                                    scheduleBlock.startsAt,
                                    clinicTimezone,
                                  )}
                                </p>

                                <p className="text-sm text-muted-foreground">
                                  até{" "}
                                  {formatDateTime(
                                    scheduleBlock.endsAt,
                                    clinicTimezone,
                                  )}
                                </p>
                              </div>

                              <span
                                className={
                                  scheduleBlock.isActive
                                    ? "w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800"
                                    : "w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                                }
                              >
                                {scheduleBlock.isActive
                                  ? "Bloqueio ativo"
                                  : "Bloqueio inativo"}
                              </span>
                            </div>

                            {scheduleBlock.reason ? (
                              <p className="border-t pt-3 text-sm">
                                {scheduleBlock.reason}
                              </p>
                            ) : null}

                            {canManageSelectedSchedule ? (
                              <div className="flex flex-wrap gap-3 border-t pt-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={
                                    statusScheduleBlockId !==
                                    null
                                  }
                                  onClick={() => {
                                    setErrorMessage(null);
                                    setSuccessMessage(null);
                                    setEditingScheduleBlockId(
                                      scheduleBlock.id,
                                    );
                                  }}
                                >
                                  Editar bloqueio
                                </Button>

                                <Button
                                  type="button"
                                  variant={
                                    scheduleBlock.isActive
                                      ? "outline"
                                      : "default"
                                  }
                                  disabled={
                                    statusScheduleBlockId !==
                                      null ||
                                    editingScheduleBlockId !==
                                      null
                                  }
                                  onClick={() =>
                                    void handleScheduleBlockStatusToggle(
                                      scheduleBlock,
                                    )
                                  }
                                >
                                  {statusScheduleBlockId ===
                                  scheduleBlock.id
                                    ? "Atualizando..."
                                    : scheduleBlock.isActive
                                      ? "Inativar bloqueio"
                                      : "Ativar bloqueio"}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}