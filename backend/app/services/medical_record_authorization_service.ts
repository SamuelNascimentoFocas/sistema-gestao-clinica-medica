import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import ClinicProfessional from '#models/clinic_professional'
import type { AppointmentStatus } from '#models/appointment'
import DomainError from '#exceptions/domain_error'

export const QUALIFYING_MEDICAL_RECORD_APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'completed',
] as const satisfies readonly AppointmentStatus[]

const MEDICAL_RECORDS_ACCESS_ALL_PERMISSION = 'medical_records.access_all'

export type PatientMedicalRecordAuthorization = {
  userId: string
  permissionCodes: readonly string[]
}

export async function assertPatientMedicalRecordAccess({
  clinicId,
  patientClinicId,
  authorization,
  client,
}: {
  clinicId: string
  patientClinicId: string
  authorization: PatientMedicalRecordAuthorization
  client?: TransactionClientContract
}) {
  if (
    authorization.permissionCodes.includes('*') ||
    authorization.permissionCodes.includes(MEDICAL_RECORDS_ACCESS_ALL_PERMISSION)
  ) {
    return
  }

  const query = client ? ClinicProfessional.query({ client }) : ClinicProfessional.query()

  const qualifyingProfessional = await query
    .where('clinic_id', clinicId)
    .where('is_active', true)
    .whereHas('professional', (professionalQuery) => {
      professionalQuery.where('user_id', authorization.userId).where('is_active', true)
    })
    .whereHas('appointments', (appointmentQuery) => {
      appointmentQuery
        .where('clinic_id', clinicId)
        .where('patient_clinic_id', patientClinicId)
        .whereIn('status', [...QUALIFYING_MEDICAL_RECORD_APPOINTMENT_STATUSES])
    })
    .first()

  if (!qualifyingProfessional) {
    throw new DomainError(
      'forbidden',
      'O usuário não possui relação clínica ativa com este paciente neste consultório'
    )
  }
}
