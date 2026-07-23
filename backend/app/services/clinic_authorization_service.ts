import Clinic from '#models/clinic'
import User from '#models/user'
import UserClinicRole from '#models/user_clinic_role'

export type ClinicAuthorizationContext = {
  clinic: Clinic
  membership: UserClinicRole | null
  permissionCodes: string[]
}

type ClinicAuthorizationResult =
  | {
      allowed: true
      context: ClinicAuthorizationContext
    }
  | {
      allowed: false
      status: 403 | 404
      message: string
    }

export async function authorizeClinicAccess({
  user,
  clinicId,
  requiredPermissions,
}: {
  user: User
  clinicId: string
  requiredPermissions: string[]
}): Promise<ClinicAuthorizationResult> {
  if (!user.isActive) {
    return {
      allowed: false,
      status: 403,
      message: 'Usuário inativo',
    }
  }

  const clinic = await Clinic.find(clinicId)

  if (!clinic) {
    return {
      allowed: false,
      status: 404,
      message: 'Consultório não encontrado',
    }
  }

  if (!clinic.isActive) {
    return {
      allowed: false,
      status: 403,
      message: 'Consultório inativo',
    }
  }

  if (user.isGlobalAdmin) {
    return {
      allowed: true,
      context: {
        clinic,
        membership: null,
        permissionCodes: ['*'],
      },
    }
  }

  const membership = await UserClinicRole.query()
    .where('user_id', user.id)
    .where('clinic_id', clinic.id)
    .where('is_active', true)
    .preload('role', (roleQuery) => {
      roleQuery.preload('permissions', (permissionQuery) => {
        permissionQuery.where('is_active', true)
      })
    })
    .first()

  if (!membership) {
    return {
      allowed: false,
      status: 403,
      message: 'Usuário sem vínculo ativo com este consultório',
    }
  }

  if (!membership.role.isActive) {
    return {
      allowed: false,
      status: 403,
      message: 'O perfil deste vínculo está inativo',
    }
  }

  const permissionCodes = membership.role.permissions.map((permission) => permission.code)

  const hasAllRequiredPermissions = requiredPermissions.every((permission) =>
    permissionCodes.includes(permission)
  )

  if (!hasAllRequiredPermissions) {
    return {
      allowed: false,
      status: 403,
      message: 'Permissão insuficiente para acessar este recurso',
    }
  }

  return {
    allowed: true,
    context: {
      clinic,
      membership,
      permissionCodes,
    },
  }
}
