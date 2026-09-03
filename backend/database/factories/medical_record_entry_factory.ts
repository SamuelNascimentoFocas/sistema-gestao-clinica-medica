import factory from '@adonisjs/lucid/factories'
import MedicalRecordEntry from '#models/medical_record_entry'

// Sem grafo automático: todos os IDs devem pertencer ao contexto do cenário.
export const MedicalRecordEntryFactory = factory
  .define(MedicalRecordEntry, () => ({
    appointmentId: null,
    entryTypeCode: 'evolution' as const,
    content: 'Evolução clínica de teste.',
    correctsEntryId: null,
  }))
  .build()
