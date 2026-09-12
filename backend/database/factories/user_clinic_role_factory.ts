import factory from '@adonisjs/lucid/factories'
import UserClinicRole from '#models/user_clinic_role'
import { UserFactory } from './user_factory.js'
import { ClinicFactory } from './clinic_factory.js'

// The seeded role and existing clinic/user IDs must be explicit, or use .with().
export const UserClinicRoleFactory = factory
  .define(UserClinicRole, () => ({ isActive: true }))
  .relation('user', () => UserFactory)
  .relation('clinic', () => ClinicFactory)
  .build()
