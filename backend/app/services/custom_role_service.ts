import { randomUUID } from 'node:crypto'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import Role from '#models/role'
import { getUniqueConstraint } from '#services/postgres_error'
import {
  assertCustomRolePermissionGrant,
  listCustomRoleAssignablePermissions,
  resolveCustomRolePermissions,
  type RoleGrantActor,
} from '#services/role_grant_service'

type CustomRolePayload = {
  name: string
  description?: string | null
  permissionCodes: string[]
}

function normalizedName(name: string) {
  return name.trim().toLocaleLowerCase('pt-BR')
}

async function assertSystemRoleNameAvailable(name: string) {
  const reservedRole = await Role.query()
    .where('is_system', true)
    .whereRaw('lower(btrim(name)) = ?', [normalizedName(name)])
    .first()

  if (reservedRole) {
    throw new Exception('Este nome é reservado para um perfil do sistema', {
      status: 409,
      code: 'E_ROLE_NAME_RESERVED',
    })
  }
}

async function loadVisibleRole(clinicId: string, roleId: string) {
  return Role.query()
    .where('id', roleId)
    .where((scopeQuery) => {
      scopeQuery.where('is_system', true).orWhere((customQuery) => {
        customQuery.where('is_system', false).where('clinic_id', clinicId)
      })
    })
    .preload('permissions', (permissionQuery) => permissionQuery.orderBy('code', 'asc'))
    .first()
}

async function loadMutableCustomRole(clinicId: string, roleId: string) {
  const role = await loadVisibleRole(clinicId, roleId)

  if (!role) {
    throw new Exception('Perfil não encontrado neste consultório', {
      status: 404,
      code: 'E_ROLE_NOT_FOUND',
    })
  }

  if (role.isSystem) {
    throw new Exception('Perfis do sistema são imutáveis', {
      status: 409,
      code: 'E_SYSTEM_ROLE_IMMUTABLE',
    })
  }

  return role
}

function throwRoleNameConflict(error: unknown): never {
  if (getUniqueConstraint(error) === 'roles_custom_clinic_name_unique') {
    throw new Exception('Já existe um perfil com este nome neste consultório', {
      status: 409,
      code: 'E_ROLE_NAME_CONFLICT',
    })
  }

  throw error
}

export async function listManagedClinicRoles(clinicId: string) {
  return Role.query()
    .where((scopeQuery) => {
      scopeQuery.where('is_system', true).orWhere((customQuery) => {
        customQuery.where('is_system', false).where('clinic_id', clinicId)
      })
    })
    .preload('permissions', (permissionQuery) => permissionQuery.orderBy('code', 'asc'))
    .orderBy('is_system', 'desc')
    .orderBy('name', 'asc')
}

export async function listAssignableClinicRoles({
  clinicId,
  actor,
}: {
  clinicId: string
  actor: RoleGrantActor
}) {
  const roles = await Role.query()
    .where('is_active', true)
    .where((scopeQuery) => {
      scopeQuery.where('is_system', true).orWhere((customQuery) => {
        customQuery.where('is_system', false).where('clinic_id', clinicId)
      })
    })
    .preload('permissions', (permissionQuery) => {
      permissionQuery.where('is_active', true).orderBy('code', 'asc')
    })
    .orderBy('is_system', 'desc')
    .orderBy('name', 'asc')

  if (actor.isGlobalAdmin) {
    return roles
  }

  const actorPermissions = new Set(actor.permissionCodes)
  return roles.filter((role) =>
    role.permissions.every((permission) => actorPermissions.has(permission.code))
  )
}

export async function showClinicRole(clinicId: string, roleId: string) {
  const role = await loadVisibleRole(clinicId, roleId)

  if (!role) {
    throw new Exception('Perfil não encontrado neste consultório', {
      status: 404,
      code: 'E_ROLE_NOT_FOUND',
    })
  }

  return role
}

export async function createCustomRole({
  clinicId,
  payload,
  actor,
}: {
  clinicId: string
  payload: CustomRolePayload
  actor: RoleGrantActor
}) {
  await assertSystemRoleNameAvailable(payload.name)
  const permissions = await resolveCustomRolePermissions({
    permissionCodes: payload.permissionCodes,
    actor,
  })

  try {
    const roleId = await db.transaction(async (trx) => {
      const role = new Role()
      role.code = `custom_${randomUUID().replaceAll('-', '')}`
      role.name = payload.name.trim()
      role.description = payload.description?.trim() || null
      role.clinicId = clinicId
      role.isSystem = false
      role.isActive = true
      role.useTransaction(trx)
      await role.save()
      await role.related('permissions').sync(permissions.map((permission) => permission.id))
      return role.id
    })

    return showClinicRole(clinicId, roleId)
  } catch (error) {
    throwRoleNameConflict(error)
  }
}

export async function updateCustomRole({
  clinicId,
  roleId,
  payload,
  actor,
}: {
  clinicId: string
  roleId: string
  payload: CustomRolePayload
  actor: RoleGrantActor
}) {
  await loadMutableCustomRole(clinicId, roleId)
  await assertSystemRoleNameAvailable(payload.name)
  const permissions = await resolveCustomRolePermissions({
    permissionCodes: payload.permissionCodes,
    actor,
  })

  try {
    await db.transaction(async (trx) => {
      const role = await Role.query({ client: trx })
        .where('id', roleId)
        .where('clinic_id', clinicId)
        .where('is_system', false)
        .forUpdate()
        .firstOrFail()

      role.name = payload.name.trim()
      role.description = payload.description?.trim() || null
      await role.save()
      await role.related('permissions').sync(permissions.map((permission) => permission.id))
    })

    return showClinicRole(clinicId, roleId)
  } catch (error) {
    throwRoleNameConflict(error)
  }
}

export async function updateCustomRoleStatus({
  clinicId,
  roleId,
  isActive,
  actor,
}: {
  clinicId: string
  roleId: string
  isActive: boolean
  actor: RoleGrantActor
}) {
  await loadMutableCustomRole(clinicId, roleId)

  await db.transaction(async (trx) => {
    const role = await Role.query({ client: trx })
      .where('id', roleId)
      .where('clinic_id', clinicId)
      .where('is_system', false)
      .preload('permissions', (permissionQuery) => {
        permissionQuery.where('is_active', true)
      })
      .forUpdate()
      .firstOrFail()

    if (!role.isActive && isActive) {
      assertCustomRolePermissionGrant({
        permissionCodes: role.permissions.map((permission) => permission.code),
        actor,
      })
    }

    role.isActive = isActive
    await role.save()
  })

  return showClinicRole(clinicId, roleId)
}

export { listCustomRoleAssignablePermissions }
