import db from '@adonisjs/lucid/services/db'

export async function truncateClinicSchemaTables() {
  await db.rawQuery(`
    TRUNCATE TABLE
      clinic.auth_access_tokens,
      clinic.user_clinic_roles,
      clinic.role_permissions,
      clinic.permissions,
      clinic.roles,
      clinic.clinics,
      clinic.users
    RESTART IDENTITY CASCADE
  `)
}
