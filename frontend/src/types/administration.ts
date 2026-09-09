import type { AuthUser } from "@/types/auth";
import type { PaginationMeta } from "@/types/pagination";

export type ClinicRolePermission = {
  id: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClinicRoleSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  clinicId: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClinicRole = ClinicRoleSummary & {
  permissions: ClinicRolePermission[];
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
  role: ClinicRoleSummary;
};

export type ClinicMembersResponse = {
  data: ClinicMember[];
  meta: PaginationMeta;
};

export type ClinicMemberResponse = {
  membership: ClinicMember;
};

export type ClinicRolesResponse = {
  data: ClinicRole[];
};

export type ClinicRoleResponse = {
  role: ClinicRole;
};

export type ClinicRolePermissionsResponse = {
  data: ClinicRolePermission[];
};
