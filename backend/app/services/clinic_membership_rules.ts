import UserClinicRole from '#models/user_clinic_role'

async function isEffectiveClinicAdmin(membership: UserClinicRole) {
  await membership.load('user')
  await membership.load('role')

  return (
    membership.isActive &&
    membership.user.isActive &&
    membership.role.isActive &&
    membership.role.code === 'clinic_admin'
  )
}

export async function isLastActiveClinicAdmin(membership: UserClinicRole) {
  if (!(await isEffectiveClinicAdmin(membership))) {
    return false
  }

  const anotherActiveAdmin = await UserClinicRole.query()
    .where('clinic_id', membership.clinicId)
    .where('is_active', true)
    .whereNot('id', membership.id)
    .whereHas('user', (userQuery) => {
      userQuery.where('is_active', true)
    })
    .whereHas('role', (roleQuery) => {
      roleQuery.where('code', 'clinic_admin').where('is_active', true)
    })
    .first()

  return !anotherActiveAdmin
}

export async function isUserLastActiveClinicAdmin(userId: string) {
  const memberships = await UserClinicRole.query()
    .where('user_id', userId)
    .where('is_active', true)
    .preload('user')
    .preload('role')

  for (const membership of memberships) {
    if (await isLastActiveClinicAdmin(membership)) {
      return true
    }
  }

  return false
}
