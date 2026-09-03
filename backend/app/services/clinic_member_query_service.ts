import UserClinicRole from '#models/user_clinic_role'

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
