import factory from '@adonisjs/lucid/factories'
import Clinic from '#models/clinic'
import { nextFixtureSequence } from './fixture_sequence.js'

export const ClinicFactory = factory
  .define(Clinic, () => ({
    name: `Clínica Fixture ${nextFixtureSequence('clinic')}`,
    cnpj: null,
    phone: null,
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
