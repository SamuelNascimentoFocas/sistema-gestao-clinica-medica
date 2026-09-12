import factory from '@adonisjs/lucid/factories'
import User from '#models/user'
import { nextFixtureSequence } from './fixture_sequence.js'

export const UserFactory = factory
  .define(User, () => {
    const sequence = nextFixtureSequence('user')
    const email = `factory.user.${sequence}@example.test`
    return {
      fullName: 'Usuário de Teste',
      email,
      emailNormalized: email,
      passwordHash: 'TestPassword!123',
      isGlobalAdmin: false,
      isActive: true,
    }
  })
  .merge((user, attributes) => {
    user.merge(attributes)
    if (attributes.email !== undefined && attributes.emailNormalized === undefined) {
      user.emailNormalized = attributes.email.toLowerCase()
    }
  })
  .state('globalAdmin', (user) => {
    user.isGlobalAdmin = true
  })
  .state('inactive', (user) => {
    user.isActive = false
  })
  .build()
