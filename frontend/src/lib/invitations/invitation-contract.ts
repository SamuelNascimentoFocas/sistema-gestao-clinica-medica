import type {
  ClinicMember,
  ClinicMemberUser,
  ClinicMembersResponse,
  ClinicRoleSummary,
  InvitationStatus,
} from "@/types/administration";
import type { PaginationMeta } from "@/types/pagination";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,100}$/;
const INVITATION_STATUSES = new Set<InvitationStatus>([
  "not_invited",
  "accepted",
  "revoked",
  "expired",
  "sent",
  "pending_dispatch",
]);

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 422; message: string };

type FragmentLocation = {
  hash: string;
  pathname: string;
};

type FragmentHistory = {
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function parseRoleSummary(value: unknown): ClinicRoleSummary | null {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    typeof value.code !== "string" ||
    typeof value.name !== "string" ||
    !(typeof value.description === "string" || value.description === null) ||
    !(isUuid(value.clinicId) || value.clinicId === null) ||
    typeof value.isSystem !== "boolean" ||
    typeof value.isActive !== "boolean" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !(
      (value.isSystem && value.clinicId === null) ||
      (!value.isSystem && isUuid(value.clinicId))
    )
  ) {
    return null;
  }

  return value as ClinicRoleSummary;
}

function parsePaginationMeta(value: unknown): PaginationMeta | null {
  if (!isRecord(value)) return null;

  for (const key of ["total", "perPage", "currentPage", "lastPage"] as const) {
    const field = value[key];
    if (typeof field !== "number" || !Number.isInteger(field) || field < 0) {
      return null;
    }
  }

  const meta = value as unknown as PaginationMeta;
  if (meta.perPage < 1 || meta.currentPage < 1) return null;
  return meta;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isDateOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && !Number.isNaN(Date.parse(value)));
}

function parseInvitationStatus(value: unknown): InvitationStatus | null {
  return typeof value === "string" && INVITATION_STATUSES.has(value as InvitationStatus)
    ? (value as InvitationStatus)
    : null;
}

export function takeInvitationTokenFromFragment(
  location: FragmentLocation,
  history: FragmentHistory,
) {
  const fragment = location.hash;

  if (fragment) {
    const safePath = location.pathname.startsWith("/")
      ? location.pathname
      : "/accept-invitation";
    history.replaceState(null, "", safePath);
  }

  if (!fragment.startsWith("#")) return null;

  const params = new URLSearchParams(fragment.slice(1));
  const entries = [...params.entries()];

  if (entries.length !== 1 || entries[0]?.[0] !== "token") return null;

  const token = entries[0][1];
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function parseInvitationTokenPayload(
  value: unknown,
): ParseResult<{ token: string }> {
  if (!isRecord(value)) {
    return { ok: false, status: 400, message: "Corpo da requisição inválido" };
  }

  if (!hasExactKeys(value, ["token"]) || !TOKEN_PATTERN.test(String(value.token ?? ""))) {
    return { ok: false, status: 422, message: "Convite inválido ou indisponível" };
  }

  return { ok: true, value: { token: String(value.token) } };
}

export function parseInvitationAcceptancePayload(
  value: unknown,
): ParseResult<{
  token: string;
  password: string;
  passwordConfirmation: string;
}> {
  if (!isRecord(value)) {
    return { ok: false, status: 400, message: "Corpo da requisição inválido" };
  }

  if (
    !hasExactKeys(value, ["token", "password", "passwordConfirmation"]) ||
    !TOKEN_PATTERN.test(String(value.token ?? "")) ||
    typeof value.password !== "string" ||
    typeof value.passwordConfirmation !== "string"
  ) {
    return { ok: false, status: 422, message: "Convite inválido ou indisponível" };
  }

  return {
    ok: true,
    value: {
      token: String(value.token),
      password: value.password,
      passwordConfirmation: value.passwordConfirmation,
    },
  };
}

export function parseInvitationValidationResponse(value: unknown) {
  return isRecord(value) && value.valid === true && Object.keys(value).length === 1
    ? { valid: true as const }
    : null;
}

export function parseClinicMemberUser(value: unknown): ClinicMemberUser | null {
  if (!isRecord(value)) return null;

  if (
    [
      "token",
      "rawToken",
      "tokenDigest",
      "token_digest",
      "password",
      "passwordHash",
      "password_hash",
    ].some((key) => key in value)
  ) {
    return null;
  }

  const invitationStatus = parseInvitationStatus(value.invitationStatus);

  if (
    !isUuid(value.id) ||
    typeof value.fullName !== "string" ||
    typeof value.email !== "string" ||
    typeof value.isGlobalAdmin !== "boolean" ||
    typeof value.isActive !== "boolean" ||
    !(value.lastLoginAt === null || typeof value.lastLoginAt === "string") ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    typeof value.passwordConfigured !== "boolean" ||
    invitationStatus === null ||
    !isDateOrNull(value.invitationSentAt) ||
    !isDateOrNull(value.invitationExpiresAt)
  ) {
    return null;
  }

  return {
    id: value.id,
    fullName: value.fullName,
    email: value.email,
    isGlobalAdmin: value.isGlobalAdmin,
    isActive: value.isActive,
    lastLoginAt: value.lastLoginAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    passwordConfigured: value.passwordConfigured,
    invitationStatus,
    invitationSentAt: value.invitationSentAt,
    invitationExpiresAt: value.invitationExpiresAt,
  };
}

export function parseClinicMember(value: unknown): ClinicMember | null {
  if (!isRecord(value)) return null;

  const user = parseClinicMemberUser(value.user);
  const role = parseRoleSummary(value.role);

  if (
    !isUuid(value.id) ||
    !isUuid(value.userId) ||
    !isUuid(value.clinicId) ||
    !isUuid(value.roleId) ||
    typeof value.isActive !== "boolean" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !user ||
    !role ||
    user.id !== value.userId ||
    role.id !== value.roleId
  ) {
    return null;
  }

  return {
    id: value.id,
    userId: value.userId,
    clinicId: value.clinicId,
    roleId: value.roleId,
    isActive: value.isActive,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    user,
    role,
  };
}

export function parseClinicMembersResponse(value: unknown): ClinicMembersResponse | null {
  if (!isRecord(value) || !Array.isArray(value.data)) return null;
  const meta = parsePaginationMeta(value.meta);
  if (!meta) return null;

  const data = value.data.map(parseClinicMember);
  if (data.some((member) => member === null)) return null;

  return { data: data as ClinicMember[], meta };
}

export function parseInvitedUserResponse(value: unknown) {
  if (!isRecord(value)) return null;
  const user = parseClinicMemberUser(value.user);
  return user && Object.keys(value).length === 1 ? { user } : null;
}

export function canResendInvitation(user: ClinicMemberUser) {
  return user.isActive && !user.passwordConfigured;
}

export function invitationStatusLabel(status: InvitationStatus) {
  switch (status) {
    case "accepted":
      return "Convite aceito";
    case "sent":
      return "Convite enviado";
    case "pending_dispatch":
      return "Envio pendente";
    case "expired":
      return "Convite expirado";
    case "revoked":
      return "Convite revogado";
    case "not_invited":
      return "Sem convite";
  }
}
