import type { AuthUser } from "@/types/auth";

export const CLINIC_MEMBER_ROLES = [
  {
    code: "clinic_admin",
    label: "Administrador de Consultório",
  },
  {
    code: "receptionist",
    label: "Recepcionista",
  },
  {
    code: "doctor",
    label: "Médico",
  },
] as const;

export type ClinicMemberRoleCode =
  (typeof CLINIC_MEMBER_ROLES)[number]["code"];

export type ClinicMemberRole = {
  id: string;
  code: ClinicMemberRoleCode;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClinicMember = {
  id: string;
  userId: string;
  clinicId: string;
  roleId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: AuthUser;
  role: ClinicMemberRole;
};

export type ClinicMembersResponse = {
  data: ClinicMember[];
};

export type ClinicMemberResponse = {
  membership: ClinicMember;
};

export function isClinicMemberRoleCode(
  value: unknown,
): value is ClinicMemberRoleCode {
  return CLINIC_MEMBER_ROLES.some((role) => role.code === value);
}