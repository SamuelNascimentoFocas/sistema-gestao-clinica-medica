import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import testUtils from '@adonisjs/core/services/test_utils'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import CreateAdmin from '../../../commands/create_admin.js'

test.group('Command admin:create', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  group.each.setup(() => {
    ace.ui.switchMode('raw')

    return () => {
      ace.ui.switchMode('normal')
    }
  })

  test('creates an active global administrator with a hashed password', async ({ assert }) => {
    const plainPassword = 'StrongPassword!123'
    const email = 'admin.clinica@example.com'

    const command = await ace.create(CreateAdmin, [])

    command.prompt.trap('Nome completo').replyWith('Administrador da Clínica')

    command.prompt.trap('E-mail').replyWith(email)

    command.prompt.trap('Senha').replyWith(plainPassword)

    command.prompt.trap('Confirme a senha').replyWith(plainPassword)

    command.prompt.trap(`Criar administrador geral Administrador da Clínica (${email})?`).accept()

    await command.exec()

    command.assertSucceeded()

    const user = await User.query().where('email_normalized', email).firstOrFail()

    assert.equal(user.fullName, 'Administrador da Clínica')
    assert.equal(user.email, email)
    assert.equal(user.emailNormalized, email)
    assert.isTrue(user.isGlobalAdmin)
    assert.isTrue(user.isActive)
    assert.notEqual(user.passwordHash, plainPassword)

    const passwordIsValid = await hash.use('bcrypt').verify(user.passwordHash, plainPassword)

    assert.isTrue(passwordIsValid)
  })
})
