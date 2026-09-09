"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppointmentListItem } from "@/components/appointments/appointment-list-item";
import {
  RemoteDataTable,
  type RemoteDataTableColumn,
} from "@/components/data-table/remote-data-table";
import { formatAppointmentDateTime } from "@/lib/appointments/appointment-date";
import {
  getAppointmentStatusLabel,
  type Appointment,
  type AppointmentStatus,
} from "@/types/appointment";
import type { PatientClinicLink } from "@/types/patient";
import type { ClinicProfessionalLink } from "@/types/professional";

type ClinicAppointmentsTableProps = {
  clinicId: string;
  clinicTimezone: string;
  page: number;
  query: {
    from: string;
    to: string;
    status?: AppointmentStatus;
    patientClinicId?: string;
    clinicProfessionalId?: string;
  };
  patients: PatientClinicLink[];
  professionals: ClinicProfessionalLink[];
  currentUserId: string;
  currentTimeIso: string;
  canUpdateAll: boolean;
  canUpdateOwn: boolean;
  canChangeStatusAll: boolean;
  canChangeStatusOwn: boolean;
  canRescheduleAll: boolean;
  canRescheduleOwn: boolean;
  canCreateMedicalRecordEntries: boolean;
};

function statusClass(status: AppointmentStatus) {
  switch (status) {
    case "scheduled":
      return "bg-blue-100 text-blue-800";
    case "confirmed":
      return "bg-emerald-100 text-emerald-800";
    case "completed":
      return "bg-slate-200 text-slate-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    case "no_show":
      return "bg-amber-100 text-amber-800";
  }
}

export function ClinicAppointmentsTable({
  clinicId,
  clinicTimezone,
  page,
  query,
  patients,
  professionals,
  currentUserId,
  currentTimeIso,
  canUpdateAll,
  canUpdateOwn,
  canChangeStatusAll,
  canChangeStatusOwn,
  canRescheduleAll,
  canRescheduleOwn,
  canCreateMedicalRecordEntries,
}: ClinicAppointmentsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set("page", String(nextPage));
      router.push(`${pathname}?${nextSearchParams.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const columns: RemoteDataTableColumn<Appointment>[] = [
    {
      id: "schedule",
      header: "Data e horário",
      cell: (appointment) => (
        <div className="min-w-44 text-sm">
          <p className="font-medium">
            {formatAppointmentDateTime(appointment.startsAt, clinicTimezone)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            até {formatAppointmentDateTime(appointment.endsAt, clinicTimezone)}
          </p>
        </div>
      ),
    },
    {
      id: "patient",
      header: "Paciente",
      cell: (appointment) => (
        <div className="min-w-40">
          <p className="font-medium">{appointment.patientClinic.patient.fullName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {appointment.patientClinic.localRecordNumber ?? "Prontuário não informado"}
          </p>
        </div>
      ),
    },
    {
      id: "professional",
      header: "Profissional",
      cell: (appointment) => (
        <div className="min-w-40">
          <p>{appointment.clinicProfessional.professional.fullName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            CRM {appointment.clinicProfessional.professional.crmState}{" "}
            {appointment.clinicProfessional.professional.crmNumber}
          </p>
        </div>
      ),
    },
    {
      id: "type",
      header: "Tipo",
      cell: (appointment) => appointment.appointmentTypeCode ?? "Não informado",
    },
    {
      id: "status",
      header: "Situação",
      cell: (appointment) => (
        <span
          className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${statusClass(
            appointment.status,
          )}`}
        >
          {getAppointmentStatusLabel(appointment.status)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Ações",
      className: "w-px",
      cell: (appointment) => {
        const isFinalStatus = ["completed", "cancelled", "no_show"].includes(
          appointment.status,
        );
        const isOwnAppointment =
          appointment.clinicProfessional.professional.userId === currentUserId;

        return (
          <AppointmentListItem
            key={`${appointment.id}:${appointment.version}`}
            clinicId={clinicId}
            clinicTimezone={clinicTimezone}
            initialAppointment={appointment}
            patients={patients}
            professionals={professionals}
            canEdit={
              !isFinalStatus && (canUpdateAll || (canUpdateOwn && isOwnAppointment))
            }
            canChangeStatus={
              canChangeStatusAll || (canChangeStatusOwn && isOwnAppointment)
            }
            canReschedule={
              !isFinalStatus &&
              (canRescheduleAll || (canRescheduleOwn && isOwnAppointment))
            }
            canCreateMedicalRecordEntries={canCreateMedicalRecordEntries}
            currentTimeIso={currentTimeIso}
            actionsOnly
            onChanged={() => setRefreshKey((current) => current + 1)}
          />
        );
      },
    },
  ];

  return (
    <RemoteDataTable
      route={`/api/clinics/${encodeURIComponent(clinicId)}/appointments`}
      columns={columns}
      query={query}
      page={page}
      refreshKey={refreshKey}
      getRowId={(appointment) => appointment.id}
      onPageChange={handlePageChange}
      summary={(meta) =>
        meta.total === 1
          ? "1 agendamento encontrado."
          : `${meta.total} agendamentos encontrados.`
      }
      emptyTitle="Nenhum agendamento encontrado"
      emptyDescription="Ajuste o período ou os filtros para consultar outros registros."
    />
  );
}
