import factory from '@adonisjs/lucid/factories'
import ProfessionalWeeklyAvailability from '#models/professional_weekly_availability'

// Vínculo, dia e intervalo são obrigatoriamente definidos pelo cenário.
export const ProfessionalWeeklyAvailabilityFactory = factory
  .define(ProfessionalWeeklyAvailability, () => ({ isActive: true }))
  .build()
