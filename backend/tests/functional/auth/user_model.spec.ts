import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'

test.group('User model', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('hashes password, verifies credentials, serializes safely, and issues a token', async ({
    assert,
  }) => {
    const plainPassword = 'TestPassword!123'
    const normalizedEmail = 'samuel.teste@example.com'

    const user = await User.create({
      fullName: 'Samuel Teste',
      email: 'Samuel.Teste@example.com',
      emailNormalized: normalizedEmail,
      passwordHash: plainPassword,
      isGlobalAdmin: true,
      isActive: true,
    })

    assert.isString(user.id)
    assert.notEqual(user.passwordHash, plainPassword)

    const passwordIsValid = await hash.use('bcrypt').verify(user.passwordHash!, plainPassword)

    assert.isTrue(passwordIsValid)

    const authenticatedUser = await User.verifyCredentials(normalizedEmail, plainPassword)

    assert.equal(authenticatedUser.id, user.id)

    const serializedUser = user.serialize()

    assert.isFalse(Object.prototype.hasOwnProperty.call(serializedUser, 'passwordHash'))
    assert.isFalse(Object.prototype.hasOwnProperty.call(serializedUser, 'emailNormalized'))

    const token = await User.accessTokens.create(user, ['*'])
    const tokenValue = token.value!.release()

    assert.match(tokenValue, /^oat_/)
    assert.isNotNull(token.expiresAt)
  })
})
