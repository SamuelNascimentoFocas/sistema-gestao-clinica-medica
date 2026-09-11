import type {
  ClinicMemberUser,
  InvitationStatus,
} from "@/types/administration";
import type { AuthUser } from "@/types/auth";
import type { Clinic } from "@/types/clinic";
import type { PaginatedResponse, PaginationMeta } from "@/types/pagination";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CNPJ_PATTERN = /^[0-9]{14}$/;
const POSTAL_CODE_PATTERN = /^[0-9]{8}$/;
const INVITATION_STATUSES = new Set<InvitationStatus>([
  "not_invited",
  "accepted",
  "revoked",
  "expired",
  "sent",
  "pending_dispatch",
]);
const RESPONSE_SECRET_KEYS = new Set([
  "password",
  "passwordConfirmation",
  "passwordHash",
  "password_hash",
  "token",
  "rawToken",
  "tokenDigest",
  "token_digest",
  "accessToken",
  "access_token",
  "smtpPassword",
  "SMTP_PASSWORD",
]);

const CLINIC_MUTABLE_FIELDS = [
  "name",
  "cnpj",
  "phone",
  "addressStreet",
  "addressNumber",
  "addressComplement",
  "addressNeighborhood",
  "addressCity",
  "addressState",
  "addressPostalCode",
] as const;

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 422; message: string };

type GlobalInvitationMembership = {
  clinicId: string;
  roleId: string;
};

export type GlobalUserInvitationPayload = {
  fullName: string;
  email: string;
  memberships?: GlobalInvitationMembership[];
};

export type GlobalUserUpdatePayload = {
  fullName?: string;
  email?: string;
};

export type GlobalStatusPayload = {
  isActive: boolean;
};

export type GlobalClinicPayload = Partial<
  Pick<Clinic, (typeof CLINIC_MUTABLE_FIELDS)[number]>
>;

export function canAccessGlobalAdminPage(
  user: Pick<AuthUser, "isGlobalAdmin"> | null,
) {
  return user?.isGlobalAdmin === true;
}

function invalid(message: string): ParseResult<never> {
  return { ok: false, status: 422, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  return (
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}

function hasResponseSecret(value: Record<string, unknown>) {
  return Object.keys(value).some((key) => RESPONSE_SECRET_KEYS.has(key));
}

function parsePositiveInteger(value: string | null, maximum?: number) {
  if (value === null) return null;
  if (!/^[0-9]+$/.test(value)) return undefined;

  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    (maximum !== undefined && parsed > maximum)
  ) {
    return undefined;
  }

  return parsed;
}

function parseBoolean(value: string | null) {
  if (value === null) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseListQuery(
  source: URLSearchParams,
  options: {
    allowed: readonly string[];
    searchMaximum: number;
    booleans: readonly string[];
  },
): ParseResult<URLSearchParams> {
  for (const key of source.keys()) {
    if (!options.allowed.includes(key) || source.getAll(key).length !== 1) {
      return invalid("Filtros de listagem inválidos");
    }
  }

  const page = parsePositiveInteger(source.get("page"));
  const perPage = parsePositiveInteger(source.get("perPage"), 100);
  if (page === undefined || perPage === undefined) {
    return invalid("Paginação inválida");
  }

  const result = new URLSearchParams({
    page: String(page ?? 1),
    perPage: String(perPage ?? 20),
  });
  const rawSearch = source.get("search");

  if (rawSearch !== null) {
    const search = rawSearch.trim();
    if (!search || search.length > options.searchMaximum) {
      return invalid("Pesquisa inválida");
    }
    result.set("search", search);
  }

  for (const key of options.booleans) {
    const parsed = parseBoolean(source.get(key));
    if (parsed === undefined) return invalid("Filtro de status inválido");
    if (parsed !== null) result.set(key, String(parsed));
  }

  return { ok: true, value: result };
}

export function parseGlobalUsersQuery(source: URLSearchParams) {
  return parseListQuery(source, {
    allowed: ["page", "perPage", "search", "isActive", "isGlobalAdmin"],
    searchMaximum: 254,
    booleans: ["isActive", "isGlobalAdmin"],
  });
}

export function parseGlobalClinicsQuery(source: URLSearchParams) {
  return parseListQuery(source, {
    allowed: ["page", "perPage", "search", "isActive"],
    searchMaximum: 180,
    booleans: ["isActive"],
  });
}

export function parseGlobalUserInvitationPayload(
  value: unknown,
): ParseResult<GlobalUserInvitationPayload> {
  if (!isRecord(value)) {
    return { ok: false, status: 400, message: "Corpo da requisição inválido" };
  }
  if (!hasOnlyKeys(value, ["fullName", "email", "memberships"])) {
    return invalid("Dados do convite inválidos");
  }

  const fullName = typeof value.fullName === "string" ? value.fullName.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim() : "";
  if (
    fullName.length < 3 ||
    fullName.length > 180 ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email)
  ) {
    return invalid("Dados do convite inválidos");
  }

  if (value.memberships === undefined) {
    return { ok: true, value: { fullName, email } };
  }
  if (!Array.isArray(value.memberships)) {
    return invalid("Vínculos iniciais inválidos");
  }

  const memberships: GlobalInvitationMembership[] = [];
  const clinicIds = new Set<string>();
  for (const membership of value.memberships) {
    if (
      !isRecord(membership) ||
      !hasExactKeys(membership, ["clinicId", "roleId"]) ||
      !isUuid(membership.clinicId) ||
      !isUuid(membership.roleId) ||
      clinicIds.has(membership.clinicId)
    ) {
      return invalid("Vínculos iniciais inválidos");
    }
    clinicIds.add(membership.clinicId);
    memberships.push({
      clinicId: membership.clinicId,
      roleId: membership.roleId,
    });
  }

  return { ok: true, value: { fullName, email, memberships } };
}

export function parseGlobalUserUpdatePayload(
  value: unknown,
): ParseResult<GlobalUserUpdatePayload> {
  if (!isRecord(value)) {
    return { ok: false, status: 400, message: "Corpo da requisição inválido" };
  }
  if (
    !hasOnlyKeys(value, ["fullName", "email"]) ||
    Object.keys(value).length === 0
  ) {
    return invalid("Dados do usuário inválidos");
  }

  const result: GlobalUserUpdatePayload = {};
  if (value.fullName !== undefined) {
    if (typeof value.fullName !== "string") return invalid("Nome inválido");
    const fullName = value.fullName.trim();
    if (fullName.length < 3 || fullName.length > 180) return invalid("Nome inválido");
    result.fullName = fullName;
  }
  if (value.email !== undefined) {
    if (typeof value.email !== "string") return invalid("E-mail inválido");
    const email = value.email.trim();
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) return invalid("E-mail inválido");
    result.email = email;
  }

  return { ok: true, value: result };
}

export function parseGlobalStatusPayload(value: unknown): ParseResult<GlobalStatusPayload> {
  if (!isRecord(value)) {
    return { ok: false, status: 400, message: "Corpo da requisição inválido" };
  }
  if (!hasExactKeys(value, ["isActive"]) || typeof value.isActive !== "boolean") {
    return invalid("Status inválido");
  }
  return { ok: true, value: { isActive: value.isActive } };
}

function parseNullableString(
  value: unknown,
  minimum: number,
  maximum: number,
  pattern?: RegExp,
) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (
    normalized.length < minimum ||
    normalized.length > maximum ||
    (pattern && !pattern.test(normalized))
  ) {
    return undefined;
  }
  return normalized;
}

function parseClinicPayload(
  value: unknown,
  requireName: boolean,
): ParseResult<GlobalClinicPayload> {
  if (!isRecord(value)) {
    return { ok: false, status: 400, message: "Corpo da requisição inválido" };
  }
  if (
    !hasOnlyKeys(value, CLINIC_MUTABLE_FIELDS) ||
    Object.keys(value).length === 0 ||
    (requireName && !Object.hasOwn(value, "name"))
  ) {
    return invalid("Dados do consultório inválidos");
  }

  const result: GlobalClinicPayload = {};
  const specifications = {
    cnpj: [1, 14, CNPJ_PATTERN],
    phone: [1, 20],
    addressStreet: [1, 180],
    addressNumber: [1, 30],
    addressComplement: [1, 120],
    addressNeighborhood: [1, 120],
    addressCity: [1, 120],
    addressState: [2, 2],
    addressPostalCode: [1, 8, POSTAL_CODE_PATTERN],
  } as const;

  if (value.name !== undefined) {
    const name = parseNullableString(value.name, 2, 180);
    if (name === undefined || name === null) return invalid("Nome inválido");
    result.name = name;
  }

  for (const key of Object.keys(specifications) as Array<keyof typeof specifications>) {
    if (value[key] === undefined) continue;
    const [minimum, maximum, pattern] = specifications[key];
    const parsed = parseNullableString(value[key], minimum, maximum, pattern);
    if (parsed === undefined) return invalid("Dados do consultório inválidos");
    result[key] = key === "addressState" && parsed ? parsed.toUpperCase() : parsed;
  }

  return { ok: true, value: result };
}

export function parseGlobalClinicCreatePayload(value: unknown) {
  return parseClinicPayload(value, true);
}

export function parseGlobalClinicUpdatePayload(value: unknown) {
  return parseClinicPayload(value, false);
}

function parsePaginationMeta(value: unknown): PaginationMeta | null {
  if (!isRecord(value)) return null;
  const { total, perPage, currentPage, lastPage } = value;
  const fields = [total, perPage, currentPage, lastPage];
  if (
    fields.some(
      (field) =>
        typeof field !== "number" || !Number.isInteger(field) || field < 0,
    ) ||
    typeof perPage !== "number" ||
    typeof currentPage !== "number" ||
    perPage < 1 ||
    currentPage < 1 ||
    typeof total !== "number" ||
    typeof lastPage !== "number"
  ) {
    return null;
  }
  return {
    total,
    perPage,
    currentPage,
    lastPage,
  };
}

function parseAuthUser(value: unknown): AuthUser | null {
  if (!isRecord(value) || hasResponseSecret(value)) return null;
  if (
    !isUuid(value.id) ||
    typeof value.fullName !== "string" ||
    typeof value.email !== "string" ||
    typeof value.isGlobalAdmin !== "boolean" ||
    typeof value.isActive !== "boolean" ||
    !(value.lastLoginAt === null || typeof value.lastLoginAt === "string") ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
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
  };
}

function parseOnboardingUser(value: unknown): ClinicMemberUser | null {
  const user = parseAuthUser(value);
  if (!user || !isRecord(value)) return null;

  const invitationStatus = value.invitationStatus;
  const isDateOrNull = (candidate: unknown) =>
    candidate === null ||
    (typeof candidate === "string" && !Number.isNaN(Date.parse(candidate)));

  if (
    typeof value.passwordConfigured !== "boolean" ||
    typeof invitationStatus !== "string" ||
    !INVITATION_STATUSES.has(invitationStatus as InvitationStatus) ||
    !isDateOrNull(value.invitationSentAt) ||
    !isDateOrNull(value.invitationExpiresAt)
  ) {
    return null;
  }

  return {
    ...user,
    passwordConfigured: value.passwordConfigured,
    invitationStatus: invitationStatus as InvitationStatus,
    invitationSentAt: value.invitationSentAt as string | null,
    invitationExpiresAt: value.invitationExpiresAt as string | null,
  };
}

function parseClinic(value: unknown): Clinic | null {
  if (!isRecord(value) || hasResponseSecret(value)) return null;
  const nullableStrings = [
    "cnpj",
    "phone",
    "addressStreet",
    "addressNumber",
    "addressComplement",
    "addressNeighborhood",
    "addressCity",
    "addressState",
    "addressPostalCode",
  ] as const;
  if (
    !isUuid(value.id) ||
    typeof value.name !== "string" ||
    typeof value.isActive !== "boolean" ||
    typeof value.timezone !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    nullableStrings.some(
      (key) => !(value[key] === null || typeof value[key] === "string"),
    )
  ) {
    return null;
  }
  return {
    id: value.id,
    name: value.name,
    cnpj: value.cnpj as string | null,
    phone: value.phone as string | null,
    addressStreet: value.addressStreet as string | null,
    addressNumber: value.addressNumber as string | null,
    addressComplement: value.addressComplement as string | null,
    addressNeighborhood: value.addressNeighborhood as string | null,
    addressCity: value.addressCity as string | null,
    addressState: value.addressState as string | null,
    addressPostalCode: value.addressPostalCode as string | null,
    isActive: value.isActive,
    timezone: value.timezone,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function parseGlobalUsersResponse(
  value: unknown,
): PaginatedResponse<ClinicMemberUser> | null {
  if (!isRecord(value) || !Array.isArray(value.data)) return null;
  const data = value.data.map(parseOnboardingUser);
  const meta = parsePaginationMeta(value.meta);
  return data.some((user) => user === null) || !meta
    ? null
    : { data: data as ClinicMemberUser[], meta };
}

export function parseGlobalUserResponse(value: unknown) {
  if (!isRecord(value)) return null;
  const user = parseOnboardingUser(value.user);
  return user ? { user } : null;
}

export function parseGlobalUserStatusResponse(value: unknown) {
  if (!isRecord(value)) return null;
  const user = parseAuthUser(value.user);
  return user ? { user } : null;
}

export function parseGlobalClinicsResponse(
  value: unknown,
): PaginatedResponse<Clinic> | null {
  if (!isRecord(value) || !Array.isArray(value.data)) return null;
  const data = value.data.map(parseClinic);
  const meta = parsePaginationMeta(value.meta);
  return data.some((clinic) => clinic === null) || !meta
    ? null
    : { data: data as Clinic[], meta };
}

export function parseGlobalClinicResponse(value: unknown) {
  if (!isRecord(value)) return null;
  const clinic = parseClinic(value.clinic);
  return clinic ? { clinic } : null;
}
