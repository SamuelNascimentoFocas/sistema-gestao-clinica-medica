import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'
import { ClinicFactory } from '#database/factories/clinic_factory'
import { UserClinicRoleFactory } from '#database/factories/user_clinic_role_factory'
import { PatientFactory } from '#database/factories/patient_factory'
import { PatientClinicFactory } from '#database/factories/patient_clinic_factory'
import { MedicalRecordFactory } from '#database/factories/medical_record_factory'
import { ProfessionalFactory } from '#database/factories/professional_factory'
import { ClinicProfessionalFactory } from '#database/factories/clinic_professional_factory'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'
import Role from '#models/role'

test.group('Lucid test factories', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('generates unique users and preserves explicit overrides and states', async ({ assert }) => {
    const [first, second] = await UserFactory.createMany(2)
    assert.notEqual(first.email, second.email)
    assert.equal(first.emailNormalized, first.email)
    assert.isTrue(first.isActive)
    assert.isFalse(first.isGlobalAdmin)

    const admin = await UserFactory.apply('globalAdmin', 'inactive')
      .merge({ email: 'Factory.Admin@example.test' })
      .create()

    assert.equal(admin.emailNormalized, 'factory.admin@example.test')
    assert.isTrue(admin.isGlobalAdmin)
    assert.isFalse(admin.isActive)

    const explicit = await UserFactory.merge({
      email: 'Factory.Override@example.test',
      emailNormalized: 'explicit.normalization@example.test',
    }).make()
    assert.equal(explicit.emailNormalized, 'explicit.normalization@example.test')
  })

  test('generates unique CRM values and leaves optional CPF explicit', async ({ assert }) => {
    const [first, second] = await ProfessionalFactory.createMany(2)
    assert.notEqual(first.crmNumber, second.crmNumber)
    assert.equal(first.crmState, second.crmState)

    const [patient, anotherPatient] = await PatientFactory.createMany(2)
    assert.isNull(patient.cpf)
    assert.isNull(anotherPatient.cpf)
    const identified = await PatientFactory.merge({ cpf: '12345678901' }).create()
    assert.equal(identified.cpf, '12345678901')
  })

  test('keeps shared identities and clinic relationships explicit', async ({ assert }) => {
    await seedAuthorizationCatalog()
    const role = await Role.findByOrFail('code', 'doctor')
    const [firstClinic, secondClinic] = await ClinicFactory.createMany(2)
    const membership = await UserClinicRoleFactory.merge({
      clinicId: firstClinic.id,
      roleId: role.id,
    })
      .with('user')
      .create()
    const secondMembership = await UserClinicRoleFactory.merge({
      userId: membership.userId,
      clinicId: secondClinic.id,
      roleId: role.id,
    }).create()

    assert.equal(secondMembership.userId, membership.user.id)
    assert.notEqual(secondMembership.clinicId, membership.clinicId)

    const firstLink = await PatientClinicFactory.merge({ clinicId: firstClinic.id })
      .with('patient')
      .create()
    const secondLink = await PatientClinicFactory.merge({
      clinicId: secondClinic.id,
      patientId: firstLink.patientId,
    }).create()
    const record = await MedicalRecordFactory.merge({ patientId: firstLink.patientId }).create()
    assert.equal(secondLink.patientId, firstLink.patient.id)
    assert.equal(record.patientId, firstLink.patientId)

    const professionalLink = await ClinicProfessionalFactory.merge({ clinicId: firstClinic.id })
      .with('professional', 1, (professional) => professional.merge({ userId: membership.userId }))
      .create()
    assert.equal(professionalLink.clinicId, firstClinic.id)
    assert.equal(professionalLink.professional.userId, membership.userId)
  })
})
