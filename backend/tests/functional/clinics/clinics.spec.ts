import { UserFactory } from '#database/factories/user_factory'
import { createBearerToken } from '#tests/helpers/auth'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('Clinics', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('requires authentication and global administrator access', async ({ client }) => {
    const unauthenticatedResponse = await client
      .get('/api/v1/clinics')
      .header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const regularUser = await UserFactory.merge({
      fullName: 'Usuário Teste',
      email: 'regular@example.com',
      isGlobalAdmin: false,
    }).create()

    const regularToken = await createBearerToken(regularUser)

    const forbiddenResponse = await client
      .get('/api/v1/clinics')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${regularToken}`)

    forbiddenResponse.assertStatus(403)
    forbiddenResponse.assertBodyContains({
      message: 'Acesso restrito ao Administrador Geral',
    })

    const inactiveAdmin = await UserFactory.apply('globalAdmin', 'inactive')
      .merge({ fullName: 'Usuário Teste', email: 'inactive.admin@example.com' })
      .create()

    const inactiveToken = await createBearerToken(inactiveAdmin)

    const inactiveResponse = await client
      .get('/api/v1/clinics')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${inactiveToken}`)

    inactiveResponse.assertStatus(403)
    inactiveResponse.assertBodyContains({
      message: 'Usuário inativo',
    })
  })

  test('allows a global administrator to manage clinics', async ({ client, assert }) => {
    const admin = await UserFactory.apply('globalAdmin')
      .merge({ fullName: 'Usuário Teste', email: 'global.admin@example.com' })
      .create()

    const token = await createBearerToken(admin)

    const createResponse = await client
      .post('/api/v1/clinics')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        name: 'Clínica Modelo',
        cnpj: '12345678000195',
        phone: '3832210000',
        addressStreet: 'Rua Central',
        addressNumber: '100',
        addressNeighborhood: 'Centro',
        addressCity: 'Montes Claros',
        addressState: 'mg',
        addressPostalCode: '39400000',
      })

    createResponse.assertStatus(201)

    const createdClinic = createResponse.body().clinic

    assert.equal(createdClinic.name, 'Clínica Modelo')
    assert.equal(createdClinic.addressState, 'MG')
    assert.isTrue(createdClinic.isActive)

    const listResponse = await client
      .get('/api/v1/clinics?search=Modelo&isActive=true&page=1&perPage=10')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    listResponse.assertStatus(200)
    assert.lengthOf(listResponse.body().data, 1)
    assert.equal(listResponse.body().meta.currentPage, 1)

    const showResponse = await client
      .get(`/api/v1/clinics/${createdClinic.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    showResponse.assertStatus(200)
    assert.equal(showResponse.body().clinic.id, createdClinic.id)

    const updateResponse = await client
      .patch(`/api/v1/clinics/${createdClinic.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        name: 'Clínica Modelo Atualizada',
        phone: null,
      })

    updateResponse.assertStatus(200)
    assert.equal(updateResponse.body().clinic.name, 'Clínica Modelo Atualizada')
    assert.isNull(updateResponse.body().clinic.phone)

    const statusResponse = await client
      .patch(`/api/v1/clinics/${createdClinic.id}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        isActive: false,
      })

    statusResponse.assertStatus(200)
    assert.isFalse(statusResponse.body().clinic.isActive)

    const missingResponse = await client
      .get('/api/v1/clinics/550e8400-e29b-41d4-a716-446655440000')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    missingResponse.assertStatus(404)
  })

  test('validates clinic data and rejects duplicate CNPJ', async ({ client }) => {
    const admin = await UserFactory.apply('globalAdmin')
      .merge({ fullName: 'Usuário Teste', email: 'validation.admin@example.com' })
      .create()

    const token = await createBearerToken(admin)

    const firstResponse = await client
      .post('/api/v1/clinics')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        name: 'Primeira Clínica',
        cnpj: '98765432000110',
      })

    firstResponse.assertStatus(201)

    const duplicateResponse = await client
      .post('/api/v1/clinics')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        name: 'Segunda Clínica',
        cnpj: '98765432000110',
      })

    duplicateResponse.assertStatus(409)
    duplicateResponse.assertBodyContains({
      message: 'Já existe um consultório cadastrado com este CNPJ',
    })

    const invalidResponse = await client
      .post('/api/v1/clinics')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        name: 'Clínica Inválida',
        cnpj: '123',
        addressPostalCode: '999',
      })

    invalidResponse.assertStatus(422)
  })
})
