import type { Infer } from '@vinejs/vine/types'
import UserClinicRole from '#models/user_clinic_role'
import type { listClinicMembersValidator } from '#validators/clinic_member'

export async function listClinicMembers(
  clinicId: string,
  filters: Infer<typeof listClinicMembersValidator>
) {
  const page = filters.page ?? 1
  const perPage = filters.perPage ?? 20

  const query = UserClinicRole.query()
    .where('clinic_id', clinicId)
    .preload('user')
    .preload('role')
    .orderBy('created_at', 'asc')
    .orderBy('id', 'asc')

  if (filters.search) {
    const search = `%${filters.search}%`

    query.whereHas('user', (userQuery) => {
      userQuery.whereILike('full_name', search).orWhereILike('email', search)
    })
  }

  if (filters.roleCode) {
    query.whereHas('role', (roleQuery) => {
      roleQuery.where('code', filters.roleCode!)
    })
  }

  if (filters.isActive !== undefined) {
    query.where('is_active', filters.isActive)
  }

  return query.paginate(page, perPage)
}

export async function loadScopedMembership({
  clinicId,
  membershipId,
}: {
  clinicId: string
  membershipId: string
}) {
  return UserClinicRole.query()
    .where('id', membershipId)
    .where('clinic_id', clinicId)
    .preload('user')
    .preload('clinic')
    .preload('role')
    .first()
}

export async function loadMembershipRelations(membershipId: string) {
  return UserClinicRole.query()
    .where('id', membershipId)
    .preload('user')
    .preload('clinic')
    .preload('role')
    .firstOrFail()
}
