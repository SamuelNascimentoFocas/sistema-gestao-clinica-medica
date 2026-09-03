import factory from '@adonisjs/lucid/factories'
import ClinicProfessional from '#models/clinic_professional'
import { ClinicFactory } from './clinic_factory.js'
import { ProfessionalFactory } from './professional_factory.js'

// A clínica e o profissional são sempre selecionados explicitamente pelo cenário.
export const ClinicProfessionalFactory = factory
  .define(ClinicProfessional, () => ({
    localCode: null,
    defaultAppointmentDurationMinutes: 30,
    acceptsAppointments: true,
    isActive: true,
  }))
  .relation('clinic', () => ClinicFactory)
  .relation('professional', () => ProfessionalFactory)
  .build()
