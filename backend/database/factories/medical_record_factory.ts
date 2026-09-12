import factory from '@adonisjs/lucid/factories'
import MedicalRecord from '#models/medical_record'
import { PatientFactory } from './patient_factory.js'

// Um prontuário por paciente: reutilize o mesmo registro entre clínicas.
export const MedicalRecordFactory = factory
  .define(MedicalRecord, () => ({}))
  .relation('patient', () => PatientFactory)
  .build()
