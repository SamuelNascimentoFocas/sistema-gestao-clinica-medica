import factory from '@adonisjs/lucid/factories'
import Professional from '#models/professional'
import { nextFixtureSequence } from './fixture_sequence.js'

// CRM gerado não se confunde com os valores explícitos dos cenários existentes.
export const ProfessionalFactory = factory
  .define(Professional, () => ({
    userId: null,
    fullName: 'Profissional de Teste',
    crmNumber: String(900000000 + nextFixtureSequence('professional')),
    crmState: 'MG',
    specialty: 'Clínica Médica',
    phone: null,
    email: null,
    isActive: true,
  }))
  .build()
