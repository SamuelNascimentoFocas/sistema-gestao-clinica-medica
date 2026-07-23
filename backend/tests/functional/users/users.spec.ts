import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'

async function createUser({
  email,
  isGlobalAdmin,
  isActive = true,
}: {
  email: string
  isGlobalAdmin: boolean
  isActive?: boolean
}) {
  return User.create({
    fullName: 'Usuário Teste',
    email,
    emailNormalized: email.toLowerCase(),
    passwordHash: 'TestPassword!123',
    isGlobalAdmin,
    isActive,
  })
}

async function createBearerToken(user: User) {
  const token = await User.accessTokens.create(user)

  return token.value!.release()
}

test.group('Users', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('requires authentication and global administrator access', async ({ client }) => {
    const unauthenticatedResponse = await client
      .get('/api/v1/users')
      .header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const regularUser = await createUser({
      email: 'regular.user@example.com',
      isGlobalAdmin: false,
    })

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
    const admin = await createUser({
      email: 'users.admin@example.com',
      isGlobalAdmin: true,
    })

    const token = await createBearerToken(admin)

    const createResponse = await client
      .post('/api/v1/users')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Recepcionista Modelo',
        email: 'Recepcionista.Modelo@example.com',
        password: 'InitialPassword!123',
      })

    createResponse.assertStatus(201)

    const createdUser = createResponse.body().user

    assert.equal(createdUser.fullName, 'Recepcionista Modelo')
    assert.equal(createdUser.email, 'Recepcionista.Modelo@example.com')
    assert.isFalse(createdUser.isGlobalAdmin)
    assert.isTrue(createdUser.isActive)
    assert.isUndefined(createdUser.passwordHash)
    assert.isUndefined(createdUser.emailNormalized)

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

    const updateResponse = await client
      .patch(`/api/v1/users/${createdUser.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Recepcionista Atualizada',
        email: 'recepcionista.atualizada@example.com',
        password: 'UpdatedPassword!123',
      })

    updateResponse.assertStatus(200)
    assert.equal(updateResponse.body().user.fullName, 'Recepcionista Atualizada')

    const loginResponse = await client
      .post('/api/v1/auth/login')
      .header('Accept', 'application/json')
      .json({
        email: 'RECEPCIONISTA.ATUALIZADA@example.com',
        password: 'UpdatedPassword!123',
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
        password: 'UpdatedPassword!123',
      })

    inactiveLoginResponse.assertStatus(403)
  })

  test('rejects duplicate email, invalid data, and self-deactivation', async ({ client }) => {
    const admin = await createUser({
      email: 'validation.users.admin@example.com',
      isGlobalAdmin: true,
    })

    const token = await createBearerToken(admin)

    const firstResponse = await client
      .post('/api/v1/users')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Primeiro Usuário',
        email: 'duplicate.user@example.com',
        password: 'InitialPassword!123',
      })

    firstResponse.assertStatus(201)

    const duplicateResponse = await client
      .post('/api/v1/users')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Segundo Usuário',
        email: 'DUPLICATE.USER@example.com',
        password: 'AnotherPassword!123',
      })

    duplicateResponse.assertStatus(409)
    duplicateResponse.assertBodyContains({
      message: 'Já existe um usuário cadastrado com este e-mail',
    })

    const invalidResponse = await client
      .post('/api/v1/users')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'A',
        email: 'email-invalido',
        password: 'curta',
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
