import factory from '@adonisjs/lucid/factories'
import MedicalRecordAttachment from '#models/medical_record_attachment'
import { nextFixtureSequence } from './fixture_sequence.js'

// Somente metadados. Testes de download fornecem chave/hash/tamanho e gravam
// o conteúdo real explicitamente, fora da factory.
export const MedicalRecordAttachmentFactory = factory
  .define(MedicalRecordAttachment, () => ({
    originalName: 'clinical-document.pdf',
    storageDisk: 'private_fs',
    storageKey: `medical-records/fixtures/attachment-${nextFixtureSequence('attachment')}.pdf`,
    contentType: 'application/pdf',
    sizeInBytes: 2048,
    sha256: 'a'.repeat(64),
    status: 'available' as const,
    statusReason: null,
  }))
  .build()
