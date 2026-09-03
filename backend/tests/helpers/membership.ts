import type User from '#models/user'
import type Clinic from '#models/clinic'
import Role from '#models/role'
import { UserClinicRoleFactory } from '#database/factories/user_clinic_role_factory'

export async function createMembership({
  user,
  clinic,
  roleCode,
  isActive = true,
}: {
  user: User
  clinic: Clinic
  roleCode: 'clinic_admin' | 'receptionist' | 'doctor'
  isActive?: boolean
}) {
  const role = await Role.findByOrFail('code', roleCode)
  return UserClinicRoleFactory.merge({
    userId: user.id,
    clinicId: clinic.id,
    roleId: role.id,
    isActive,
  }).create()
}
