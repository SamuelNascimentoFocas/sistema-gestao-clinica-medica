import { UserFactory } from '#database/factories/user_factory'
import { createBearerToken } from '#tests/helpers/auth'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('Users', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('requires authentication and global administrator access', async ({ client }) => {
    const unauthenticatedResponse = await client
      .get('/api/v1/users')
      .header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const regularUser = await UserFactory.merge({
      fullName: 'Usuário Teste',
      email: 'regular.user@example.com',
      isGlobalAdmin: false,
    }).create()

    const token = await createBearerToken(regularUser)

    const forbiddenResponse = await client
      .get('/api/v1/users')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    forbiddenResponse.assertStatus(403)
    forbiddenResponse.assertBodyContains({
      message: 'Acesso restrito ao Administrador Geral',
    })
  })

  test('allows a global administrator to manage users', async ({ client, assert }) => {
    const admin = await UserFactory.apply('globalAdmin')
      .merge({ fullName: 'Usuário Teste', email: 'users.admin@example.com' })
      .create()

    const token = await createBearerToken(admin)
    const createdUser = await UserFactory.merge({
      fullName: 'Recepcionista Modelo',
      email: 'Recepcionista.Modelo@example.com',
    }).create()

    const listResponse = await client
      .get('/api/v1/users?search=Recepcionista&page=1&perPage=10')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    listResponse.assertStatus(200)
    assert.lengthOf(listResponse.body().data, 1)
    assert.equal(listResponse.body().meta.currentPage, 1)

    const showResponse = await client
      .get(`/api/v1/users/${createdUser.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    showResponse.assertStatus(200)
    assert.equal(showResponse.body().user.id, createdUser.id)
    assert.isUndefined(showResponse.body().user.passwordHash)
    assert.isUndefined(showResponse.body().user.emailNormalized)

    const updateResponse = await client
      .patch(`/api/v1/users/${createdUser.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Recepcionista Atualizada',
        email: 'recepcionista.atualizada@example.com',
      })

    updateResponse.assertStatus(200)
    assert.equal(updateResponse.body().user.fullName, 'Recepcionista Atualizada')

    const loginResponse = await client
      .post('/api/v1/auth/login')
      .header('Accept', 'application/json')
      .json({
        email: 'RECEPCIONISTA.ATUALIZADA@example.com',
        password: 'TestPassword!123',
      })

    loginResponse.assertStatus(200)

    const statusResponse = await client
      .patch(`/api/v1/users/${createdUser.id}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        isActive: false,
      })

    statusResponse.assertStatus(200)
    assert.isFalse(statusResponse.body().user.isActive)

    const inactiveLoginResponse = await client
      .post('/api/v1/auth/login')
      .header('Accept', 'application/json')
      .json({
        email: 'recepcionista.atualizada@example.com',
        password: 'TestPassword!123',
      })

    inactiveLoginResponse.assertStatus(403)
  })

  test('removes legacy creation and rejects administrative password changes atomically', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('globalAdmin')
      .merge({ fullName: 'Usuário Teste', email: 'validation.users.admin@example.com' })
      .create()
    const token = await createBearerToken(admin)
    const target = await UserFactory.merge({
      fullName: 'Usuário Preservado',
      email: 'preserved.user@example.com',
    }).create()
    const originalPasswordHash = target.passwordHash

    const removedCreateResponse = await client
      .post('/api/v1/users')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Usuário Legado',
        email: 'legacy.user@example.com',
        password: 'InitialPassword!123',
      })
    removedCreateResponse.assertStatus(404)

    const passwordResponse = await client
      .patch(`/api/v1/users/${target.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({ password: 'UpdatedPassword!123' })
    passwordResponse.assertStatus(422)

    const confirmationResponse = await client
      .patch(`/api/v1/users/${target.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({ passwordConfirmation: 'UpdatedPassword!123' })
    confirmationResponse.assertStatus(422)

    const mixedResponse = await client
      .patch(`/api/v1/users/${target.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({ fullName: 'Não Deve Persistir', password: 'UpdatedPassword!123' })
    mixedResponse.assertStatus(422)

    const mixedConfirmationResponse = await client
      .patch(`/api/v1/users/${target.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        email: 'must.not.persist@example.com',
        passwordConfirmation: 'UpdatedPassword!123',
      })
    mixedConfirmationResponse.assertStatus(422)

    await target.refresh()
    assert.equal(target.fullName, 'Usuário Preservado')
    assert.equal(target.email, 'preserved.user@example.com')
    assert.equal(target.passwordHash, originalPasswordHash)
  })

  test('rejects duplicate email, invalid data, and self-deactivation', async ({ client }) => {
    const admin = await UserFactory.apply('globalAdmin')
      .merge({ fullName: 'Usuário Teste', email: 'validation.users.admin@example.com' })
      .create()
    const firstUser = await UserFactory.merge({
      fullName: 'Primeiro Usuário',
      email: 'duplicate.user@example.com',
    }).create()
    const secondUser = await UserFactory.merge({
      fullName: 'Segundo Usuário',
      email: 'second.user@example.com',
    }).create()
    const token = await createBearerToken(admin)

    const duplicateResponse = await client
      .patch(`/api/v1/users/${secondUser.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({ email: firstUser.email.toUpperCase() })
    duplicateResponse.assertStatus(409)

    const invalidResponse = await client
      .patch(`/api/v1/users/${secondUser.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'A',
        email: 'email-invalido',
      })

    invalidResponse.assertStatus(422)

    const selfDeactivationResponse = await client
      .patch(`/api/v1/users/${admin.id}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        isActive: false,
      })

    selfDeactivationResponse.assertStatus(409)
    selfDeactivationResponse.assertBodyContains({
      message: 'Você não pode inativar seu próprio usuário',
    })
  })
})
