import { ClinicFactory } from '#database/factories/clinic_factory'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import Patient from '#models/patient'
import PatientClinic from '#models/patient_clinic'
import MedicalRecord from '#models/medical_record'
import { truncateClinicSchemaTables } from '../../helpers/database.js'

async function createPatient({ fullName, cpf }: { fullName: string; cpf: string | null }) {
  return Patient.create({
    fullName,
    birthDate: DateTime.fromISO('1990-05-10'),
    cpf,
    phone: null,
    email: null,
    addressStreet: null,
    addressNumber: null,
    addressComplement: null,
    addressNeighborhood: null,
    addressCity: null,
    addressState: null,
    addressPostalCode: null,
    isActive: true,
  })
}

test.group('Patient models', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('relates a patient to clinics and one medical record', async ({ assert }) => {
    const clinic = await ClinicFactory.merge({ name: 'Clínica do Paciente' }).create()

    const patient = await createPatient({
      fullName: 'Paciente Modelo',
      cpf: '12345678901',
    })

    const clinicLink = await patient.related('clinicLinks').create({
      clinicId: clinic.id,
      localRecordNumber: 'PRONT-001',
      isActive: true,
    })

    const medicalRecord = await patient.related('medicalRecord').create({})

    const loadedPatient = await Patient.query()
      .where('id', patient.id)
      .preload('clinicLinks', (query) => {
        query.preload('clinic')
      })
      .preload('medicalRecord')
      .firstOrFail()

    assert.lengthOf(loadedPatient.clinicLinks, 1)
    assert.equal(loadedPatient.clinicLinks[0].clinic.id, clinic.id)
    assert.equal(loadedPatient.clinicLinks[0].localRecordNumber, 'PRONT-001')
    assert.equal(loadedPatient.medicalRecord.id, medicalRecord.id)

    await clinic.load('patientLinks')
    assert.lengthOf(clinic.patientLinks, 1)

    await clinicLink.load('patient')
    await clinicLink.load('clinic')
    await medicalRecord.load('patient')

    assert.equal(clinicLink.patient.id, patient.id)
    assert.equal(clinicLink.clinic.id, clinic.id)
    assert.equal(medicalRecord.patient.id, patient.id)
  })

  test('enforces global CPF uniqueness while allowing missing CPF', async ({ assert }) => {
    await createPatient({
      fullName: 'Primeiro Paciente',
      cpf: '98765432100',
    })

    await assert.rejects(() =>
      createPatient({
        fullName: 'Paciente Duplicado',
        cpf: '98765432100',
      })
    )

    await createPatient({
      fullName: 'Paciente sem CPF 1',
      cpf: null,
    })

    await createPatient({
      fullName: 'Paciente sem CPF 2',
      cpf: null,
    })

    const patientsWithoutCpf = await Patient.query().whereNull('cpf')

    assert.lengthOf(patientsWithoutCpf, 2)
  })

  test('enforces clinic-link and medical-record uniqueness', async ({ assert }) => {
    const firstClinic = await ClinicFactory.merge({ name: 'Primeira Clínica' }).create()
    const secondClinic = await ClinicFactory.merge({ name: 'Segunda Clínica' }).create()

    const firstPatient = await createPatient({
      fullName: 'Primeiro Paciente',
      cpf: '11122233344',
    })

    const secondPatient = await createPatient({
      fullName: 'Segundo Paciente',
      cpf: '55566677788',
    })

    await PatientClinic.create({
      patientId: firstPatient.id,
      clinicId: firstClinic.id,
      localRecordNumber: 'LOCAL-001',
      isActive: true,
    })

    await assert.rejects(() =>
      PatientClinic.create({
        patientId: firstPatient.id,
        clinicId: firstClinic.id,
        localRecordNumber: 'LOCAL-002',
        isActive: true,
      })
    )

    await assert.rejects(() =>
      PatientClinic.create({
        patientId: secondPatient.id,
        clinicId: firstClinic.id,
        localRecordNumber: 'LOCAL-001',
        isActive: true,
      })
    )

    await PatientClinic.create({
      patientId: secondPatient.id,
      clinicId: secondClinic.id,
      localRecordNumber: 'LOCAL-001',
      isActive: true,
    })

    await MedicalRecord.create({
      patientId: firstPatient.id,
    })

    await assert.rejects(() =>
      MedicalRecord.create({
        patientId: firstPatient.id,
      })
    )
  })
})
