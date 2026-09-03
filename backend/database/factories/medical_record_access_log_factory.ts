import factory from '@adonisjs/lucid/factories'
import MedicalRecordAccessLog from '#models/medical_record_access_log'

// Ação, finalidade, instante e contexto ficam visíveis nos testes de auditoria.
export const MedicalRecordAccessLogFactory = factory
  .define(MedicalRecordAccessLog, () => ({
    medicalRecordAttachmentId: null,
    purposeNote: null,
  }))
  .build()
