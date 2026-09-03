import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'
import Patient from '#models/patient'

// CPF é opcional: cenários de identidade/duplicidade fornecem o valor explicitamente.
export const PatientFactory = factory
  .define(Patient, () => ({
    fullName: 'Paciente de Teste',
    birthDate: DateTime.fromISO('1990-05-10'),
    cpf: null,
    phone: null,
    email: null,
    addressStreet: null,
    addressNumber: null,
    addressComplement: null,
    addressNeighborhood: null,
    addressCity: null,
    addressState: null,
    addressPostalCode: null,
    isActive: true,
  }))
  .build()
