import type { Infer } from '@vinejs/vine/types'
import db from '@adonisjs/lucid/services/db'
import Appointment from '#models/appointment'
import MedicalRecordEntry from '#models/medical_record_entry'
import DomainError from '#exceptions/domain_error'
import type {
  createMedicalRecordEntryValidator,
  correctMedicalRecordEntryValidator,
} from '#validators/medical_record'
import { loadPatientContext, loadClinicalAuthor } from '#services/medical_record_context_service'
import {
  loadMedicalRecordEntry,
  type MedicalRecordContext,
} from '#services/medical_record_read_service'
import { getPostgreSqlError } from '#services/postgres_error'

export async function createMedicalRecordEntry(
  { clinicId, patientId, userId, permissionCodes }: MedicalRecordContext,
  payload: Infer<typeof createMedicalRecordEntryValidator>
) {
  const result = await db.transaction(async (trx) => {
    const { patientLink, patient, medicalRecord } = await loadPatientContext({
      clinicId,
      patientId,
      authorization: { userId, permissionCodes },
      client: trx,
      lock: true,
    })

    const professionalLink = await loadClinicalAuthor({
      clinicId,
      userId,
      client: trx,
      lock: true,
    })

    let appointmentId: string | null = null

    if (payload.appointmentId) {
      const appointment = await Appointment.query({
        client: trx,
      })
        .where('clinic_id', clinicId)
        .where('id', payload.appointmentId)
        .where('patient_clinic_id', patientLink.id)
        .where('clinic_professional_id', professionalLink.id)
        .forUpdate()
        .first()

      if (!appointment) {
        throw new DomainError(
          'not_found',
          'Agendamento compatível não encontrado neste consultório'
        )
      }

      if (appointment.status !== 'completed') {
        throw new DomainError(
          'conflict',
          'Somente agendamentos realizados podem ser vinculados a entradas clínicas'
        )
      }

      appointmentId = appointment.id
    }

    const entry = new MedicalRecordEntry()
    entry.useTransaction(trx)

    entry.merge({
      medicalRecordId: medicalRecord.id,
      patientId: patient.id,
      clinicId,
      patientClinicId: patientLink.id,
      clinicProfessionalId: professionalLink.id,
      appointmentId,
      authorUserId: userId,
      entryTypeCode: payload.entryTypeCode,
      content: payload.content,
      correctsEntryId: null,
    })

    await entry.save()

    return {
      medicalRecordId: medicalRecord.id,
      entryId: entry.id,
    }
  })

  const entry = await loadMedicalRecordEntry(result)

  return entry!
}

export async function correctMedicalRecordEntry(
  { clinicId, patientId, userId, permissionCodes }: MedicalRecordContext,
  entryId: string,
  payload: Infer<typeof correctMedicalRecordEntryValidator>
) {
  try {
    const result = await db.transaction(async (trx) => {
      const { patientLink, patient, medicalRecord } = await loadPatientContext({
        clinicId,
        patientId,
        authorization: { userId, permissionCodes },
        client: trx,
        lock: true,
      })

      const professionalLink = await loadClinicalAuthor({
        clinicId,
        userId,
        client: trx,
        lock: true,
      })

      const originalEntry = await MedicalRecordEntry.query({
        client: trx,
      })
        .where('medical_record_id', medicalRecord.id)
        .where('clinic_id', clinicId)
        .where('id', entryId)
        .forUpdate()
        .first()

      if (!originalEntry) {
        throw new DomainError('not_found', 'Entrada do prontuário não encontrada neste consultório')
      }

      const existingCorrection = await MedicalRecordEntry.query({
        client: trx,
      })
        .where('corrects_entry_id', originalEntry.id)
        .first()

      if (existingCorrection) {
        throw new DomainError(
          'conflict',
          'Esta entrada já possui uma correção direta; atualize a timeline e corrija a entrada mais recente'
        )
      }

      const correction = new MedicalRecordEntry()
      correction.useTransaction(trx)

      correction.merge({
        medicalRecordId: medicalRecord.id,
        patientId: patient.id,
        clinicId,
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        appointmentId: null,
        authorUserId: userId,
        entryTypeCode: 'correction',
        content: payload.content,
        correctsEntryId: originalEntry.id,
      })

      await correction.save()

      return {
        medicalRecordId: medicalRecord.id,
        entryId: correction.id,
      }
    })

    const entry = await loadMedicalRecordEntry(result)

    return entry!
  } catch (error) {
    const databaseError = getPostgreSqlError(error)
    if (
      databaseError?.code === '23505' &&
      databaseError.constraint === 'medical_record_entries_corrects_entry_unique'
    ) {
      throw new DomainError(
        'conflict',
        'Esta entrada já foi corrigida por outra operação; atualize a timeline'
      )
    }
    throw error
  }
}
