import type { Infer } from '@vinejs/vine/types'
import db from '@adonisjs/lucid/services/db'
import Patient from '#models/patient'
import PatientClinic from '#models/patient_clinic'
import MedicalRecord from '#models/medical_record'
import DomainError from '#exceptions/domain_error'
import { loadPatientLink, rethrowPatientError } from '#services/patient_service'
import type { createPatientValidator } from '#validators/patient'

export async function registerPatient(
  clinicId: string,
  payload: Infer<typeof createPatientValidator>
) {
  try {
    const result = await db.transaction(async (trx) => {
      let patient: Patient | null = null

      if (payload.cpf) {
        patient = await Patient.query({ client: trx }).where('cpf', payload.cpf).first()
      }

      if (patient) {
        if (!patient.isActive) {
          throw new DomainError(
            'conflict',
            'Não é possível vincular um paciente globalmente inativo'
          )
        }

        if (patient.birthDate.toISODate() !== payload.birthDate.toISODate()) {
          throw new DomainError(
            'conflict',
            'O CPF informado pertence a um paciente com outra data de nascimento'
          )
        }

        const existingLink = await PatientClinic.query({
          client: trx,
        })
          .where('patient_id', patient.id)
          .where('clinic_id', clinicId)
          .first()

        if (existingLink) {
          throw new DomainError('conflict', 'Este paciente já está vinculado ao consultório')
        }
      } else {
        patient = new Patient()
        patient.useTransaction(trx)

        patient.merge({
          fullName: payload.fullName,
          birthDate: payload.birthDate,
          cpf: payload.cpf ?? null,
          phone: payload.phone ?? null,
          email: payload.email?.toLowerCase() ?? null,
          addressStreet: payload.addressStreet ?? null,
          addressNumber: payload.addressNumber ?? null,
          addressComplement: payload.addressComplement ?? null,
          addressNeighborhood: payload.addressNeighborhood ?? null,
          addressCity: payload.addressCity ?? null,
          addressState: payload.addressState?.toUpperCase() ?? null,
          addressPostalCode: payload.addressPostalCode ?? null,
          isActive: true,
        })

        await patient.save()
      }

      if (payload.localRecordNumber) {
        const existingLocalRecord = await PatientClinic.query({
          client: trx,
        })
          .where('clinic_id', clinicId)
          .where('local_record_number', payload.localRecordNumber)
          .first()

        if (existingLocalRecord) {
          throw new DomainError(
            'conflict',
            'Este número de prontuário local já está em uso no consultório'
          )
        }
      }

      let medicalRecord = await MedicalRecord.query({
        client: trx,
      })
        .where('patient_id', patient.id)
        .first()

      if (!medicalRecord) {
        medicalRecord = new MedicalRecord()
        medicalRecord.useTransaction(trx)
        medicalRecord.patientId = patient.id
        await medicalRecord.save()
      }

      const patientLink = new PatientClinic()
      patientLink.useTransaction(trx)
      patientLink.patientId = patient.id
      patientLink.clinicId = clinicId
      patientLink.localRecordNumber = payload.localRecordNumber ?? null
      patientLink.isActive = true

      await patientLink.save()

      return {
        patientId: patient.id,
      }
    })

    const patientLink = await loadPatientLink({
      clinicId,
      patientId: result.patientId,
    })

    return patientLink!
  } catch (error) {
    rethrowPatientError(error)
  }
}
