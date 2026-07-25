import db from '@adonisjs/lucid/services/db'

export async function truncateClinicSchemaTables() {
  await db.rawQuery(`
    TRUNCATE TABLE
      clinic.auth_access_tokens,
      clinic.medical_record_access_logs,
      clinic.medical_record_attachments,
      clinic.medical_record_entries,
      clinic.appointments,
      clinic.professional_schedule_blocks,
      clinic.professional_weekly_availabilities,
      clinic.clinic_professionals,
      clinic.professionals,
      clinic.user_clinic_roles,
      clinic.role_permissions,
      clinic.permissions,
      clinic.roles,
      clinic.medical_records,
      clinic.patient_clinics,
      clinic.patients,
      clinic.clinics,
      clinic.users
    RESTART IDENTITY CASCADE
  `)
}
