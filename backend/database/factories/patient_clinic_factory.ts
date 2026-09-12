import factory from '@adonisjs/lucid/factories'
import PatientClinic from '#models/patient_clinic'
import { PatientFactory } from './patient_factory.js'
import { ClinicFactory } from './clinic_factory.js'

export const PatientClinicFactory = factory
  .define(PatientClinic, () => ({ localRecordNumber: null, isActive: true }))
  .relation('patient', () => PatientFactory)
  .relation('clinic', () => ClinicFactory)
  .build()
