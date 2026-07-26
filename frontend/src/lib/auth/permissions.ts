export function hasAnyPermission(
  permissionCodes: readonly string[],
  requiredPermissions: readonly string[],
) {
  if (requiredPermissions.length === 0) {
    return true;
  }

  if (permissionCodes.includes("*")) {
    return true;
  }

  return requiredPermissions.some((permission) =>
    permissionCodes.includes(permission),
  );
}