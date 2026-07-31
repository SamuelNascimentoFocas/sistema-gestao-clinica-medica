import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditLogListItem } from "@/components/audit-logs/audit-log-list-item";
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
import { getClinicAuditLogs } from "@/lib/server/clinic-audit-logs";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";
import { getClinicMembers } from "@/lib/server/clinic-members";
import { getClinicPatients } from "@/lib/server/clinic-patients";
import {
  AUDIT_LOG_ACTION_OPTIONS,
  AUDIT_LOG_PURPOSE_OPTIONS,
  type AuditLogAccessAction,
  type AuditLogPurposeCode,
} from "@/types/audit-log";

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

type AuditLogPageFilters = {
  fromDate: string;
  toDate: string;
  userId?: string;
  patientId?: string;
  accessAction?: AuditLogAccessAction;
  purposeCode?: AuditLogPurposeCode;
};

export const metadata = {
  title: "Auditoria",
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

function parseAccessAction(
  value: string | undefined,
): AuditLogAccessAction | undefined {
  return AUDIT_LOG_ACTION_OPTIONS.some(
    (option) => option.value === value,
  )
    ? (value as AuditLogAccessAction)
    : undefined;
}

function parsePurposeCode(
  value: string | undefined,
): AuditLogPurposeCode | undefined {
  return AUDIT_LOG_PURPOSE_OPTIONS.some(
    (option) => option.value === value,
  )
    ? (value as AuditLogPurposeCode)
    : undefined;
}

function buildAuditLogsHref(
  clinicId: string,
  filters: AuditLogPageFilters,
  page: number,
) {
  const searchParams = new URLSearchParams({
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    page: String(page),
  });

  if (filters.userId) {
    searchParams.set("userId", filters.userId);
  }

  if (filters.patientId) {
    searchParams.set(
      "patientId",
      filters.patientId,
    );
  }

  if (filters.accessAction) {
    searchParams.set(
      "accessAction",
      filters.accessAction,
    );
  }

  if (filters.purposeCode) {
    searchParams.set(
      "purposeCode",
      filters.purposeCode,
    );
  }

  return `/clinics/${encodeURIComponent(
    clinicId,
  )}/audit-logs?${searchParams.toString()}`;
}

export default async function AuditLogsPage({
  params,
  searchParams,
}: PageProps) {
  const { clinicId } = await params;
  const query = await searchParams;

  const context = await requireClinicPermissions(
    clinicId,
    ["audit_logs.read"],
  );

  const [members, patientsResponse] =
    await Promise.all([
      getClinicMembers(clinicId),
      getClinicPatients(clinicId, {
        page: 1,
        perPage: 100,
      }),
    ]);

  if (!members || !patientsResponse) {
    notFound();
  }

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
      : addDaysToDateInput(today, -6);

  const toDate =
    requestedToDate &&
    isValidDateInput(requestedToDate)
      ? requestedToDate
      : today;

  const requestedUserId = readSearchParam(
    query.userId,
  );

  const userId =
    requestedUserId &&
    members.some(
      (member) =>
        member.user.id === requestedUserId,
    )
      ? requestedUserId
      : undefined;

  const requestedPatientId = readSearchParam(
    query.patientId,
  );

  const patientId =
    requestedPatientId &&
    patientsResponse.data.some(
      (patientLink) =>
        patientLink.patient.id ===
        requestedPatientId,
    )
      ? requestedPatientId
      : undefined;

  const accessAction = parseAccessAction(
    readSearchParam(query.accessAction),
  );

  const purposeCode = parsePurposeCode(
    readSearchParam(query.purposeCode),
  );

  const page = parsePositiveInteger(
    readSearchParam(query.page),
  );

  const differenceInDays =
    differenceInDateInputs(fromDate, toDate);

  const rangeError =
    differenceInDays < 0
      ? "A data inicial deve ser anterior ou igual à data final."
      : null;

  const filters: AuditLogPageFilters = {
    fromDate,
    toDate,
    userId,
    patientId,
    accessAction,
    purposeCode,
  };

  const auditLogsResponse = rangeError
    ? null
    : await getClinicAuditLogs(clinicId, {
        page,
        perPage: 20,
        from: localDateStartToUtcIso(
          fromDate,
          context.clinic.timezone,
        ),
        to: localDateStartToUtcIso(
          addDaysToDateInput(toDate, 1),
          context.clinic.timezone,
        ),
        userId,
        patientId,
        accessAction,
        purposeCode,
      });

  if (!rangeError && !auditLogsResponse) {
    notFound();
  }

  const logs = auditLogsResponse?.data ?? [];

  const meta = auditLogsResponse?.meta ?? {
    total: 0,
    perPage: 20,
    currentPage: 1,
    lastPage: 1,
    firstPage: 1,
    firstPageUrl: null,
    lastPageUrl: null,
    nextPageUrl: null,
    previousPageUrl: null,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Auditoria
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Consulte os acessos realizados aos
          prontuários e anexos clínicos do
          consultório.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros da auditoria</CardTitle>

          <CardDescription>
            A data final é incluída integralmente na
            consulta.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            method="get"
            className="space-y-5"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="audit-from-date">
                  Data inicial
                </Label>

                <Input
                  key={fromDate}
                  id="audit-from-date"
                  name="fromDate"
                  type="date"
                  required
                  defaultValue={fromDate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="audit-to-date">
                  Data final
                </Label>

                <Input
                  key={toDate}
                  id="audit-to-date"
                  name="toDate"
                  type="date"
                  required
                  defaultValue={toDate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="audit-user">
                  Usuário responsável
                </Label>

                <select
                  id="audit-user"
                  name="userId"
                  defaultValue={userId ?? ""}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">
                    Todos os usuários
                  </option>

                  {members.map((member) => (
                    <option
                      key={member.id}
                      value={member.user.id}
                    >
                      {member.user.fullName} —{" "}
                      {member.role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="audit-patient">
                  Paciente
                </Label>

                <select
                  id="audit-patient"
                  name="patientId"
                  defaultValue={patientId ?? ""}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">
                    Todos os pacientes
                  </option>

                  {patientsResponse.data.map(
                    (patientLink) => (
                      <option
                        key={patientLink.id}
                        value={
                          patientLink.patient.id
                        }
                      >
                        {
                          patientLink.patient
                            .fullName
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="audit-action">
                  Ação registrada
                </Label>

                <select
                  id="audit-action"
                  name="accessAction"
                  defaultValue={
                    accessAction ?? ""
                  }
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">
                    Todas as ações
                  </option>

                  {AUDIT_LOG_ACTION_OPTIONS.map(
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
                <Label htmlFor="audit-purpose">
                  Finalidade
                </Label>

                <select
                  id="audit-purpose"
                  name="purposeCode"
                  defaultValue={
                    purposeCode ?? ""
                  }
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">
                    Todas as finalidades
                  </option>

                  {AUDIT_LOG_PURPOSE_OPTIONS.map(
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
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit">
                Aplicar filtros
              </Button>

              <Link
                href={`/clinics/${encodeURIComponent(
                  clinicId,
                )}/audit-logs`}
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
            <CardTitle>Registros de acesso</CardTitle>

            <CardDescription>
              {meta.total === 1
                ? "1 evento de auditoria encontrado."
                : `${meta.total} eventos de auditoria encontrados.`}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {logs.length === 0 ? (
              <div className="py-8 text-center">
                <p className="font-medium">
                  Nenhum evento encontrado
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Ajuste o período ou os filtros para
                  consultar outros registros.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map((log) => (
                  <AuditLogListItem
                    key={log.id}
                    log={log}
                    clinicTimezone={
                      context.clinic.timezone
                    }
                  />
                ))}
              </div>
            )}

            {meta.lastPage > 1 ? (
              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Página {meta.currentPage} de{" "}
                  {meta.lastPage}
                </p>

                <div className="flex gap-3">
                  {meta.currentPage > 1 ? (
                    <Link
                      href={buildAuditLogsHref(
                        clinicId,
                        filters,
                        meta.currentPage - 1,
                      )}
                      className="border-input bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
                    >
                      Anterior
                    </Link>
                  ) : null}

                  {meta.currentPage <
                  meta.lastPage ? (
                    <Link
                      href={buildAuditLogsHref(
                        clinicId,
                        filters,
                        meta.currentPage + 1,
                      )}
                      className="border-input bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
                    >
                      Próxima
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}