import type { AuthUser } from "@/types/auth";
import type { PaginationMeta } from "@/types/pagination";

export type InvitationStatus =
  | "not_invited"
  | "accepted"
  | "revoked"
  | "expired"
  | "sent"
  | "pending_dispatch";

export type ClinicMemberUser = AuthUser & {
  passwordConfigured: boolean;
  invitationStatus: InvitationStatus;
  invitationSentAt: string | null;
  invitationExpiresAt: string | null;
};

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

type ClinicMemberWithUser<TUser extends AuthUser> = {
  id: string;
  userId: string;
  clinicId: string;
  roleId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: TUser;
  role: ClinicRoleSummary;
};

export type ClinicMember = ClinicMemberWithUser<ClinicMemberUser>;
export type ClinicMemberMutation = ClinicMemberWithUser<AuthUser>;

export type ClinicMembersResponse = {
  data: ClinicMember[];
  meta: PaginationMeta;
};

export type ClinicMemberResponse = {
  membership: ClinicMemberMutation;
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
