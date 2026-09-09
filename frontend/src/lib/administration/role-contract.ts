import type {
  ClinicRole,
  ClinicRolePermission,
  ClinicRolePermissionsResponse,
  ClinicRoleResponse,
  ClinicRolesResponse,
  ClinicRoleSummary,
} from "@/types/administration";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 422; message: string };

type CustomRoleInput = {
  name: string;
  description: string;
  permissionCodes: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasString(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "string";
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function parsePermission(value: unknown): ClinicRolePermission | null {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    !hasString(value, "code") ||
    !hasString(value, "description") ||
    typeof value.isActive !== "boolean" ||
    !hasString(value, "createdAt") ||
    !hasString(value, "updatedAt")
  ) {
    return null;
  }

  return value as ClinicRolePermission;
}

function parseRoleSummary(value: unknown): ClinicRoleSummary | null {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    !hasString(value, "code") ||
    !hasString(value, "name") ||
    !(typeof value.description === "string" || value.description === null) ||
    !(isUuid(value.clinicId) || value.clinicId === null) ||
    typeof value.isSystem !== "boolean" ||
    typeof value.isActive !== "boolean" ||
    !hasString(value, "createdAt") ||
    !hasString(value, "updatedAt") ||
    !(
      (value.isSystem && value.clinicId === null) ||
      (!value.isSystem && isUuid(value.clinicId))
    )
  ) {
    return null;
  }

  return value as ClinicRoleSummary;
}

export function parseClinicRole(value: unknown): ClinicRole | null {
  const summary = parseRoleSummary(value);

  if (!summary || !isRecord(value) || !Array.isArray(value.permissions)) {
    return null;
  }

  const permissions = value.permissions.map(parsePermission);

  if (permissions.some((permission) => permission === null)) {
    return null;
  }

  return {
    ...summary,
    permissions: permissions as ClinicRolePermission[],
  };
}

export function parseClinicRolesResponse(value: unknown): ClinicRole[] | null {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    return null;
  }

  const roles = value.data.map(parseClinicRole);

  if (roles.some((role) => role === null)) {
    return null;
  }

  return (value as ClinicRolesResponse).data;
}

export function parseClinicRoleResponse(value: unknown): ClinicRole | null {
  if (!isRecord(value)) {
    return null;
  }

  const role = parseClinicRole(value.role);
  return role ? (value as ClinicRoleResponse).role : null;
}

export function parseClinicRolePermissionsResponse(
  value: unknown,
): ClinicRolePermission[] | null {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    return null;
  }

  const permissions = value.data.map(parsePermission);

  if (permissions.some((permission) => permission === null)) {
    return null;
  }

  return (value as ClinicRolePermissionsResponse).data;
}

export function parseCustomRolePayload(
  value: unknown,
): ParseResult<{
  name: string;
  description: string | null;
  permissionCodes: string[];
}> {
  if (!isRecord(value)) {
    return { ok: false, status: 400, message: "Corpo da requisição inválido" };
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  const description =
    typeof value.description === "string" ? value.description.trim() : null;

  if (name.length < 3 || name.length > 120) {
    return {
      ok: false,
      status: 422,
      message: "O nome deve possuir entre 3 e 120 caracteres",
    };
  }

  if (
    !(value.description === undefined || value.description === null || typeof value.description === "string") ||
    (description?.length ?? 0) > 255
  ) {
    return {
      ok: false,
      status: 422,
      message: "A descrição deve possuir no máximo 255 caracteres",
    };
  }

  if (!Array.isArray(value.permissionCodes)) {
    return {
      ok: false,
      status: 422,
      message: "Informe uma lista válida de permissões",
    };
  }

  const permissionCodes = value.permissionCodes.map((code) =>
    typeof code === "string" ? code.trim() : "",
  );

  if (
    permissionCodes.some((code) => code.length < 1 || code.length > 100) ||
    new Set(permissionCodes).size !== permissionCodes.length
  ) {
    return {
      ok: false,
      status: 422,
      message: "Informe permissões válidas e sem duplicidade",
    };
  }

  return {
    ok: true,
    value: {
      name,
      description: description || null,
      permissionCodes,
    },
  };
}

export function parseRoleStatusPayload(
  value: unknown,
): ParseResult<{ isActive: boolean }> {
  if (!isRecord(value)) {
    return { ok: false, status: 400, message: "Corpo da requisição inválido" };
  }

  if (typeof value.isActive !== "boolean") {
    return { ok: false, status: 422, message: "O status informado é inválido" };
  }

  return { ok: true, value: { isActive: value.isActive } };
}

export function parseRoleIdPayload(
  value: unknown,
): ParseResult<{ roleId: string }> {
  if (!isRecord(value)) {
    return { ok: false, status: 400, message: "Corpo da requisição inválido" };
  }

  if (!isUuid(value.roleId) || "roleCode" in value) {
    return { ok: false, status: 422, message: "Perfil inválido" };
  }

  return { ok: true, value: { roleId: value.roleId } };
}

export function customRoleInputToPayload(input: CustomRoleInput) {
  return {
    name: input.name.trim(),
    description: input.description.trim() || null,
    permissionCodes: [...input.permissionCodes],
  };
}

export function rolesForMembershipSelect(
  assignableRoles: readonly ClinicRole[],
  currentRole?: ClinicRoleSummary,
) {
  if (!currentRole || assignableRoles.some((role) => role.id === currentRole.id)) {
    return [...assignableRoles];
  }

  return [currentRole, ...assignableRoles];
}
