import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const SessionsController = () => import('#controllers/sessions_controller')
const ClinicsController = () => import('#controllers/clinics_controller')
const UsersController = () => import('#controllers/users_controller')
const ClinicMembershipsController = () => import('#controllers/clinic_memberships_controller')
const ClinicContextsController = () => import('#controllers/clinic_contexts_controller')
const PatientsController = () => import('#controllers/patients_controller')

router.get('/', async () => {
  return {
    name: 'Clinic Management API',
    status: 'ok',
  }
})

router
  .group(() => {
    router.post('/login', [SessionsController, 'store'])
  })
  .prefix('/api/v1/auth')

router
  .group(() => {
    router.get('/me', [SessionsController, 'show'])
    router.delete('/logout', [SessionsController, 'destroy'])
  })
  .prefix('/api/v1/auth')
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )

router
  .group(() => {
    router.get('/', [ClinicsController, 'index'])
    router.post('/', [ClinicsController, 'store'])

    router.get('/:id', [ClinicsController, 'show']).where('id', router.matchers.uuid())

    router.patch('/:id', [ClinicsController, 'update']).where('id', router.matchers.uuid())

    router
      .patch('/:id/status', [ClinicsController, 'updateStatus'])
      .where('id', router.matchers.uuid())
  })
  .prefix('/api/v1/clinics')
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )
  .use(middleware.globalAdmin())

router
  .group(() => {
    router.get('/', [UsersController, 'index'])
    router.post('/', [UsersController, 'store'])

    router.get('/:id', [UsersController, 'show']).where('id', router.matchers.uuid())

    router.patch('/:id', [UsersController, 'update']).where('id', router.matchers.uuid())

    router
      .patch('/:id/status', [UsersController, 'updateStatus'])
      .where('id', router.matchers.uuid())
  })
  .prefix('/api/v1/users')
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )
  .use(middleware.globalAdmin())

router
  .group(() => {
    router.get('/', [ClinicMembershipsController, 'index'])
    router.post('/', [ClinicMembershipsController, 'store'])

    router.get('/:id', [ClinicMembershipsController, 'show']).where('id', router.matchers.uuid())

    router
      .patch('/:id', [ClinicMembershipsController, 'update'])
      .where('id', router.matchers.uuid())

    router
      .patch('/:id/status', [ClinicMembershipsController, 'updateStatus'])
      .where('id', router.matchers.uuid())
  })
  .prefix('/api/v1/clinic-memberships')
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )
  .use(middleware.globalAdmin())

router
  .get('/api/v1/clinics/:clinicId/context', [ClinicContextsController, 'show'])
  .where('clinicId', router.matchers.uuid())
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )
  .use(
    middleware.clinicPermission({
      permissions: ['clinics.read'],
    })
  )

router
  .get('/api/v1/clinics/:clinicId/members', [ClinicContextsController, 'members'])
  .where('clinicId', router.matchers.uuid())
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )
  .use(
    middleware.clinicPermission({
      permissions: ['users.read'],
    })
  )

router
  .group(() => {
    router.get('/', [PatientsController, 'index']).use(
      middleware.clinicPermission({
        permissions: ['patients.read'],
      })
    )

    router.post('/', [PatientsController, 'store']).use(
      middleware.clinicPermission({
        permissions: ['patients.create'],
      })
    )

    router.get('/:patientId', [PatientsController, 'show']).use(
      middleware.clinicPermission({
        permissions: ['patients.read'],
      })
    )

    router.patch('/:patientId', [PatientsController, 'update']).use(
      middleware.clinicPermission({
        permissions: ['patients.update'],
      })
    )

    router.patch('/:patientId/status', [PatientsController, 'updateStatus']).use(
      middleware.clinicPermission({
        permissions: ['patients.update'],
      })
    )
  })
  .prefix('/api/v1/clinics/:clinicId/patients')
  .where('clinicId', router.matchers.uuid())
  .where('patientId', router.matchers.uuid())
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )
