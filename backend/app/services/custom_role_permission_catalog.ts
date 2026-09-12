const NON_CUSTOM_ROLE_ASSIGNABLE_PERMISSION_CODES = new Set([
  'clinics.create',
  'clinics.update',
  'clinics.deactivate',
  'users.update',
])

export function isCustomRoleAssignablePermission(code: string) {
  return code !== '*' && !NON_CUSTOM_ROLE_ASSIGNABLE_PERMISSION_CODES.has(code)
}
