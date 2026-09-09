import { Exception } from '@adonisjs/core/exceptions'
import Permission from '#models/permission'
import Role from '#models/role'
import { isCustomRoleAssignablePermission } from '#services/custom_role_permission_catalog'

export type RoleGrantActor = {
  isGlobalAdmin: boolean
  permissionCodes: readonly string[]
}

export function assertPermissionSubset(actor: RoleGrantActor, requestedCodes: readonly string[]) {
  if (actor.isGlobalAdmin) {
    return
  }

  const actorPermissions = new Set(actor.permissionCodes)
  const unauthorizedCode = requestedCodes.find((code) => !actorPermissions.has(code))

  if (unauthorizedCode) {
    throw new Exception('Não é permitido conceder permissões que o usuário não possui', {
      status: 403,
      code: 'E_ROLE_PERMISSION_ESCALATION',
    })
  }
}

export function assertCustomRolePermissionGrant({
  permissionCodes,
  actor,
}: {
  permissionCodes: readonly string[]
  actor: RoleGrantActor
}) {
  if (permissionCodes.includes('*')) {
    throw new Exception('A permissão curinga não pode ser atribuída a perfis', {
      status: 422,
      code: 'E_ROLE_WILDCARD_NOT_ASSIGNABLE',
    })
  }

  const forbiddenCode = permissionCodes.find((code) => !isCustomRoleAssignablePermission(code))

  if (forbiddenCode) {
    throw new Exception('Uma ou mais permissões não podem ser atribuídas a perfis personalizados', {
      status: 422,
      code: 'E_ROLE_PERMISSION_NOT_ASSIGNABLE',
    })
  }

  assertPermissionSubset(actor, permissionCodes)
}

export async function resolveCustomRolePermissions({
  permissionCodes,
  actor,
}: {
  permissionCodes: readonly string[]
  actor: RoleGrantActor
}) {
  const uniqueCodes = [...new Set(permissionCodes)]

  const permissions = uniqueCodes.length
    ? await Permission.query().whereIn('code', uniqueCodes).where('is_active', true)
    : []
  const permissionsByCode = new Map(permissions.map((permission) => [permission.code, permission]))
  const unavailableCode = uniqueCodes.find((code) => !permissionsByCode.has(code))

  if (unavailableCode) {
    throw new Exception('Uma ou mais permissões não existem ou estão inativas', {
      status: 422,
      code: 'E_ROLE_PERMISSION_UNAVAILABLE',
    })
  }

  assertCustomRolePermissionGrant({ permissionCodes: uniqueCodes, actor })

  return uniqueCodes.map((code) => permissionsByCode.get(code)!)
}

export async function listCustomRoleAssignablePermissions() {
  const permissions = await Permission.query().where('is_active', true).orderBy('code', 'asc')
  return permissions.filter((permission) => isCustomRoleAssignablePermission(permission.code))
}

export async function resolveRoleForAssignment({
  clinicId,
  roleId,
  actor,
}: {
  clinicId: string
  roleId: string
  actor: RoleGrantActor
}) {
  const query = Role.query()
    .where('is_active', true)
    .preload('permissions', (permissionQuery) => {
      permissionQuery.where('is_active', true)
    })

  query.where('id', roleId).where((scopeQuery) => {
    scopeQuery.where('is_system', true).orWhere((customQuery) => {
      customQuery.where('is_system', false).where('clinic_id', clinicId)
    })
  })

  const role = await query.first()

  if (!role) {
    throw new Exception('Perfil ativo não encontrado neste consultório', {
      status: 404,
      code: 'E_ROLE_NOT_FOUND',
    })
  }

  assertPermissionSubset(
    actor,
    role.permissions.map((permission) => permission.code)
  )

  return role
}
