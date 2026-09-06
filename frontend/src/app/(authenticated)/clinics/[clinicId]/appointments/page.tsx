import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
  addDaysToDateInput,
  differenceInDateInputs,
  formatDateInputInTimeZone,
  isValidDateInput,
  localDateStartToUtcIso,
} from "@/lib/appointments/appointment-date";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";
import { getClinicPatients } from "@/lib/server/clinic-patients";
import { getClinicProfessionals } from "@/lib/server/clinic-professionals";
import {
  APPOINTMENT_STATUS_OPTIONS,
  type AppointmentStatus,
} from "@/types/appointment";
import { CreateAppointmentCard } from "@/components/appointments/create-appointment-card";
import { ClinicAppointmentsTable } from "@/components/appointments/clinic-appointments-table";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/server/current-user";

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

type PageProps = {
  params: Promise<{
    clinicId: string;
  }>;
  searchParams: Promise<SearchParams>;
};

export const metadata = {
  title: "Agendamentos",
};

function readSearchParam(
  value: string | string[] | undefined,
) {
  return typeof value === "string"
    ? value
    : undefined;
}

function parsePositiveInteger(
  value: string | undefined,
) {
  if (!value) {
    return 1;
  }

  const number = Number(value);

  return Number.isInteger(number) && number > 0
    ? number
    : 1;
}

function parseAppointmentStatus(
  value: string | undefined,
): AppointmentStatus | undefined {
  return APPOINTMENT_STATUS_OPTIONS.some(
    (option) => option.value === value,
  )
    ? (value as AppointmentStatus)
    : undefined;
}

export default async function AppointmentsPage({
  params,
  searchParams,
}: PageProps) {
  const { clinicId } = await params;
  const query = await searchParams;

  const context = await requireClinicPermissions(
    clinicId,
    ["appointments.read"],
  );

  const [
    currentUser,
    patientsResponse,
    professionalsResponse,
  ] = await Promise.all([
    getCurrentUser(),
    getClinicPatients(clinicId, {
      page: 1,
      perPage: 100,
    }),
    getClinicProfessionals(clinicId, {
      page: 1,
      perPage: 100,
    }),
  ]);

  if (!currentUser) {
    redirect("/login");
  }

  if (!patientsResponse || !professionalsResponse) {
    notFound();
  }

  const canCreateAll = hasAnyPermission(
    context.access.permissions,
    ["appointments.create"],
  );

  const canCreateOwn = hasAnyPermission(
    context.access.permissions,
    ["appointments.create_own"],
  );

  const canCreateAppointments =
    canCreateAll || canCreateOwn;

  const canUpdateAll = hasAnyPermission(
    context.access.permissions,
    ["appointments.update"],
  );

  const canUpdateOwn = hasAnyPermission(
    context.access.permissions,
    ["appointments.update_own"],
  );

  const canChangeStatusAll = hasAnyPermission(
    context.access.permissions,
    ["appointments.change_status"],
  );

  const canChangeStatusOwn = hasAnyPermission(
    context.access.permissions,
    ["appointments.change_status_own"],
  );

  const canRescheduleAll =
    canCreateAll &&
    canUpdateAll &&
    canChangeStatusAll;

  const canRescheduleOwn =
    canCreateOwn &&
    canUpdateOwn &&
    canChangeStatusOwn;

  const availablePatients =
    patientsResponse.data.filter(
      (patientLink) =>
        patientLink.isActive &&
        patientLink.patient.isActive,
    );

  const availableProfessionals =
    professionalsResponse.data.filter(
      (professionalLink) =>
        professionalLink.isActive &&
        professionalLink.professional.isActive &&
        professionalLink.acceptsAppointments &&
        (canCreateAll ||
          professionalLink.professional.userId ===
            currentUser.id),
    );

  const today = formatDateInputInTimeZone(
    new Date(),
    context.clinic.timezone,
  );

  const requestedFromDate = readSearchParam(
    query.fromDate,
  );

  const requestedToDate = readSearchParam(
    query.toDate,
  );

  const fromDate =
    requestedFromDate &&
    isValidDateInput(requestedFromDate)
      ? requestedFromDate
      : today;

  const toDate =
    requestedToDate &&
    isValidDateInput(requestedToDate)
      ? requestedToDate
      : addDaysToDateInput(today, 6);

  const status = parseAppointmentStatus(
    readSearchParam(query.status),
  );

  const requestedPatientClinicId =
    readSearchParam(query.patientClinicId);

  const patientClinicId =
    requestedPatientClinicId &&
    patientsResponse.data.some(
      (patientLink) =>
        patientLink.id === requestedPatientClinicId,
    )
      ? requestedPatientClinicId
      : undefined;

  const requestedClinicProfessionalId =
    readSearchParam(query.clinicProfessionalId);

  const clinicProfessionalId =
    requestedClinicProfessionalId &&
    professionalsResponse.data.some(
      (professionalLink) =>
        professionalLink.id ===
        requestedClinicProfessionalId,
    )
      ? requestedClinicProfessionalId
      : undefined;

  const page = parsePositiveInteger(
    readSearchParam(query.page),
  );

  const differenceInDays =
    differenceInDateInputs(fromDate, toDate);

  let rangeError: string | null = null;

  if (differenceInDays < 0) {
    rangeError =
      "A data inicial deve ser anterior ou igual à data final.";
  } else if (differenceInDays > 30) {
    rangeError =
      "O período consultado não pode ultrapassar 31 dias.";
  }

  const currentTimeIso =
    new Date().toISOString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Agendamentos
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Consulte os atendimentos por período, situação,
          paciente e profissional.
        </p>
      </div>

      {canCreateAppointments ? (
        <CreateAppointmentCard
          clinicId={clinicId}
          clinicTimezone={context.clinic.timezone}
          patients={availablePatients}
          professionals={availableProfessionals}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Filtros da agenda</CardTitle>

          <CardDescription>
            O intervalo máximo permitido é de 31 dias.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            method="get"
            className="space-y-5"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="appointment-from-date">
                  Data inicial
                </Label>

                <Input
                  key={fromDate}
                  id="appointment-from-date"
                  name="fromDate"
                  type="date"
                  required
                  defaultValue={fromDate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointment-to-date">
                  Data final
                </Label>

                <Input
                  key={toDate}
                  id="appointment-to-date"
                  name="toDate"
                  type="date"
                  required
                  defaultValue={toDate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointment-status">
                  Situação
                </Label>

                <select
                  id="appointment-status"
                  name="status"
                  defaultValue={status ?? ""}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">
                    Todas as situações
                  </option>

                  {APPOINTMENT_STATUS_OPTIONS.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointment-patient">
                  Paciente
                </Label>

                <select
                  id="appointment-patient"
                  name="patientClinicId"
                  defaultValue={patientClinicId ?? ""}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">
                    Todos os pacientes
                  </option>

                  {patientsResponse.data.map(
                    (patientLink) => (
                      <option
                        key={patientLink.id}
                        value={patientLink.id}
                      >
                        {patientLink.patient.fullName}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointment-professional">
                  Profissional
                </Label>

                <select
                  id="appointment-professional"
                  name="clinicProfessionalId"
                  defaultValue={
                    clinicProfessionalId ?? ""
                  }
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">
                    Todos os profissionais
                  </option>

                  {professionalsResponse.data.map(
                    (professionalLink) => (
                      <option
                        key={professionalLink.id}
                        value={professionalLink.id}
                      >
                        {
                          professionalLink.professional
                            .fullName
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit">
                Aplicar filtros
              </Button>

              <Link
                href={`/clinics/${encodeURIComponent(
                  clinicId,
                )}/appointments`}
                className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium shadow-xs"
              >
                Limpar filtros
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {rangeError ? (
        <Card>
          <CardContent className="py-8">
            <p
              className="text-sm text-destructive"
              role="alert"
            >
              {rangeError}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Agenda do período</CardTitle>
          </CardHeader>

          <CardContent>
            <ClinicAppointmentsTable
              clinicId={clinicId}
              clinicTimezone={context.clinic.timezone}
              page={page}
              query={{
                from: localDateStartToUtcIso(
                  fromDate,
                  context.clinic.timezone,
                ),
                to: localDateStartToUtcIso(
                  addDaysToDateInput(toDate, 1),
                  context.clinic.timezone,
                ),
                status,
                patientClinicId,
                clinicProfessionalId,
              }}
              patients={availablePatients}
              professionals={availableProfessionals}
              currentUserId={currentUser.id}
              currentTimeIso={currentTimeIso}
              canUpdateAll={canUpdateAll}
              canUpdateOwn={canUpdateOwn}
              canChangeStatusAll={canChangeStatusAll}
              canChangeStatusOwn={canChangeStatusOwn}
              canRescheduleAll={canRescheduleAll}
              canRescheduleOwn={canRescheduleOwn}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
