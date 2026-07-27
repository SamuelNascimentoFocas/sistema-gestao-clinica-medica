import type { AuthUser } from "@/types/auth";

export type ProfessionalWeeklyAvailability = {
  id: string;
  clinicProfessionalId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProfessionalScheduleBlock = {
  id: string;
  clinicProfessionalId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Professional = {
  id: string;
  userId: string | null;
  fullName: string;
  crmNumber: string;
  crmState: string;
  specialty: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: AuthUser | null;
};

export type ClinicProfessionalLink = {
  id: string;
  clinicId: string;
  professionalId: string;
  localCode: string | null;
  defaultAppointmentDurationMinutes: number;
  acceptsAppointments: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  professional: Professional;
  weeklyAvailabilities?: ProfessionalWeeklyAvailability[];
  scheduleBlocks?: ProfessionalScheduleBlock[];
};

export type ProfessionalPaginationMeta = {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  firstPage: number;
  firstPageUrl: string | null;
  lastPageUrl: string | null;
  nextPageUrl: string | null;
  previousPageUrl: string | null;
};

export type ProfessionalLinksResponse = {
  data: ClinicProfessionalLink[];
  meta: ProfessionalPaginationMeta;
};

export type ProfessionalLinkResponse = {
  professionalLink: ClinicProfessionalLink;
};

export type ProfessionalStatusFilter =
  | "all"
  | "active"
  | "inactive";

export type AppointmentAcceptanceFilter =
  | "all"
  | "accepts"
  | "does-not-accept";

export type ProfessionalUserOption = {
  userId: string;
  fullName: string;
  email: string;
};

export type CreateProfessionalFormValues = {
  fullName: string;
  crmNumber: string;
  crmState: string;
  specialty: string;
  phone: string;
  email: string;
  userId: string;
  localCode: string;
  defaultAppointmentDurationMinutes: string;
  acceptsAppointments: boolean;
};

export type EditProfessionalLinkFormValues = {
  localCode: string;
  defaultAppointmentDurationMinutes: string;
  acceptsAppointments: boolean;
};

export const EMPTY_PROFESSIONAL_FORM: CreateProfessionalFormValues = {
  fullName: "",
  crmNumber: "",
  crmState: "",
  specialty: "",
  phone: "",
  email: "",
  userId: "",
  localCode: "",
  defaultAppointmentDurationMinutes: "30",
  acceptsAppointments: true,
};

export function professionalLinkToEditForm(
  professionalLink: ClinicProfessionalLink,
): EditProfessionalLinkFormValues {
  return {
    localCode: professionalLink.localCode ?? "",
    defaultAppointmentDurationMinutes: String(
      professionalLink.defaultAppointmentDurationMinutes,
    ),
    acceptsAppointments:
      professionalLink.acceptsAppointments,
  };
}