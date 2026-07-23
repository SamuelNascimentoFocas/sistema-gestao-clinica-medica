import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'

test.group('Authentication sessions', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('logs in, returns the authenticated user, and logs out', async ({ client, assert }) => {
    const plainPassword = 'TestPassword!123'

    const user = await User.create({
      fullName: 'Samuel Teste',
      email: 'Samuel.Teste@example.com',
      emailNormalized: 'samuel.teste@example.com',
      passwordHash: plainPassword,
      isGlobalAdmin: true,
      isActive: true,
    })

    const loginResponse = await client
      .post('/api/v1/auth/login')
      .header('Accept', 'application/json')
      .json({
        email: '  SAMUEL.TESTE@example.com  ',
        password: plainPassword,
      })

    loginResponse.assertStatus(200)

    const loginBody = loginResponse.body()

    assert.equal(loginBody.user.id, user.id)
    assert.equal(loginBody.user.email, 'Samuel.Teste@example.com')
    assert.isUndefined(loginBody.user.passwordHash)
    assert.isUndefined(loginBody.user.emailNormalized)
    assert.equal(loginBody.token.type, 'bearer')
    assert.match(loginBody.token.value, /^oat_/)
    assert.isNotNull(loginBody.token.expiresAt)

    await user.refresh()
    assert.isNotNull(user.lastLoginAt)

    const meResponse = await client
      .get('/api/v1/auth/me')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${loginBody.token.value}`)

    meResponse.assertStatus(200)
    assert.equal(meResponse.body().user.id, user.id)

    const logoutResponse = await client
      .delete('/api/v1/auth/logout')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${loginBody.token.value}`)

    logoutResponse.assertStatus(204)

    const meAfterLogoutResponse = await client
      .get('/api/v1/auth/me')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${loginBody.token.value}`)

    meAfterLogoutResponse.assertStatus(401)
  })

  test('rejects invalid credentials', async ({ client }) => {
    await User.create({
      fullName: 'Usuário Ativo',
      email: 'ativo@example.com',
      emailNormalized: 'ativo@example.com',
      passwordHash: 'CorrectPassword!123',
      isGlobalAdmin: false,
      isActive: true,
    })

    const response = await client
      .post('/api/v1/auth/login')
      .header('Accept', 'application/json')
      .json({
        email: 'ativo@example.com',
        password: 'WrongPassword!123',
      })

    response.assertStatus(400)
  })

  test('does not issue a token to an inactive user', async ({ client, assert }) => {
    const user = await User.create({
      fullName: 'Usuário Inativo',
      email: 'inativo@example.com',
      emailNormalized: 'inativo@example.com',
      passwordHash: 'CorrectPassword!123',
      isGlobalAdmin: false,
      isActive: false,
    })

    const response = await client
      .post('/api/v1/auth/login')
      .header('Accept', 'application/json')
      .json({
        email: 'inativo@example.com',
        password: 'CorrectPassword!123',
      })

    response.assertStatus(403)
    response.assertBodyContains({
      message: 'Usuário inativo',
    })

    const tokens = await User.accessTokens.all(user)

    assert.lengthOf(tokens, 0)
  })
})
