import type { PaginationMeta } from "@/types/pagination";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type AppointmentCancellationReason =
  | "patient_request"
  | "professional_unavailable"
  | "clinic_request"
  | "duplicate"
  | "created_by_mistake"
  | "rescheduled"
  | "other";

export type AppointmentStatusFilter =
  | "all"
  | AppointmentStatus;

export type AppointmentPatientSummary = {
  id: string;
  fullName: string;
  birthDate: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
};

export type AppointmentPatientClinicSummary = {
  id: string;
  patientId: string;
  clinicId: string;
  localRecordNumber: string | null;
  isActive: boolean;
  patient: AppointmentPatientSummary;
};

export type AppointmentProfessionalSummary = {
  id: string;
  userId: string | null;
  fullName: string;
  crmNumber: string;
  crmState: string;
  specialty: string;
  isActive: boolean;
};

export type AppointmentClinicProfessionalSummary = {
  id: string;
  clinicId: string;
  professionalId: string;
  localCode: string | null;
  defaultAppointmentDurationMinutes: number;
  acceptsAppointments: boolean;
  isActive: boolean;
  professional: AppointmentProfessionalSummary;
};

export type AppointmentUserSummary = {
  id: string;
  fullName: string;
  email: string;
};

export type Appointment = {
  id: string;
  clinicId: string;
  patientClinicId: string;
  clinicProfessionalId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  version: number;
  appointmentTypeCode: string | null;
  administrativeNote: string | null;
  createdByUserId: string;
  confirmedAt: string | null;
  confirmedByUserId: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancellationReasonCode:
    | AppointmentCancellationReason
    | null;
  cancellationNote: string | null;
  noShowAt: string | null;
  noShowByUserId: string | null;
  rescheduledFromAppointmentId: string | null;
  createdAt: string;
  updatedAt: string;
  patientClinic: AppointmentPatientClinicSummary;
  clinicProfessional:
    AppointmentClinicProfessionalSummary;
  createdByUser?: AppointmentUserSummary | null;
};

export type AppointmentsResponse = {
  data: Appointment[];
  meta: PaginationMeta;
};

export type AppointmentResponse = {
  appointment: Appointment;
};

export const APPOINTMENT_STATUS_OPTIONS = [
  {
    value: "scheduled",
    label: "Marcado",
  },
  {
    value: "confirmed",
    label: "Confirmado",
  },
  {
    value: "completed",
    label: "Realizado",
  },
  {
    value: "cancelled",
    label: "Cancelado",
  },
  {
    value: "no_show",
    label: "Falta",
  },
] as const;

export function getAppointmentStatusLabel(
  status: AppointmentStatus,
) {
  return (
    APPOINTMENT_STATUS_OPTIONS.find(
      (option) => option.value === status,
    )?.label ?? status
  );
}

export type CreateAppointmentFormValues = {
  patientClinicId: string;
  clinicProfessionalId: string;
  startsAt: string;
  durationMinutes: string;
  appointmentTypeCode: string;
  administrativeNote: string;
};

export const EMPTY_CREATE_APPOINTMENT_FORM: CreateAppointmentFormValues = {
  patientClinicId: "",
  clinicProfessionalId: "",
  startsAt: "",
  durationMinutes: "30",
  appointmentTypeCode: "",
  administrativeNote: "",
};
