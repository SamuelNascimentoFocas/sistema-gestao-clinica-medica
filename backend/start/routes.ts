import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const SessionsController = () => import('#controllers/sessions_controller')
const ClinicsController = () => import('#controllers/clinics_controller')
const UsersController = () => import('#controllers/users_controller')
const ClinicMembershipsController = () => import('#controllers/clinic_memberships_controller')
const ClinicContextsController = () => import('#controllers/clinic_contexts_controller')
const PatientsController = () => import('#controllers/patients_controller')
const ProfessionalsController = () => import('#controllers/professionals_controller')
const ProfessionalSchedulesController = () =>
  import('#controllers/professional_schedules_controller')
const AppointmentsController = () => import('#controllers/appointments_controller')
const MedicalRecordsController = () => import('#controllers/medical_records_controller')

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

router
  .group(() => {
    router.get('/', [MedicalRecordsController, 'index']).use(
      middleware.clinicPermission({
        permissions: ['patients.read', 'medical_records.read'],
      })
    )

    router.get('/entries/:entryId', [MedicalRecordsController, 'showEntry']).use(
      middleware.clinicPermission({
        permissions: ['patients.read', 'medical_records.read'],
      })
    )
  })
  .prefix('/api/v1/clinics/:clinicId/patients/:patientId/medical-record')
  .where('clinicId', router.matchers.uuid())
  .where('patientId', router.matchers.uuid())
  .where('entryId', router.matchers.uuid())
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )

router
  .group(() => {
    router.get('/', [ProfessionalsController, 'index']).use(
      middleware.clinicPermission({
        permissions: ['professionals.read'],
      })
    )

    router.post('/', [ProfessionalsController, 'store']).use(
      middleware.clinicPermission({
        permissions: ['professionals.create'],
      })
    )

    router.get('/:professionalId', [ProfessionalsController, 'show']).use(
      middleware.clinicPermission({
        permissions: ['professionals.read'],
      })
    )

    router.patch('/:professionalId', [ProfessionalsController, 'update']).use(
      middleware.clinicPermission({
        permissions: ['professionals.update'],
      })
    )

    router.patch('/:professionalId/status', [ProfessionalsController, 'updateStatus']).use(
      middleware.clinicPermission({
        permissions: ['professionals.update'],
      })
    )
  })
  .prefix('/api/v1/clinics/:clinicId/professionals')
  .where('clinicId', router.matchers.uuid())
  .where('professionalId', router.matchers.uuid())
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )

router
  .group(() => {
    router.get('/schedule', [ProfessionalSchedulesController, 'show']).use(
      middleware.clinicPermission({
        permissions: ['schedules.read'],
      })
    )

    router
      .post('/weekly-availabilities', [ProfessionalSchedulesController, 'storeWeeklyAvailability'])
      .use(
        middleware.clinicPermission({
          permissions: ['schedules.read'],
        })
      )
      .use(middleware.scheduleManagement())

    router
      .patch('/weekly-availabilities/:availabilityId', [
        ProfessionalSchedulesController,
        'updateWeeklyAvailability',
      ])
      .use(
        middleware.clinicPermission({
          permissions: ['schedules.read'],
        })
      )
      .use(middleware.scheduleManagement())

    router
      .patch('/weekly-availabilities/:availabilityId/status', [
        ProfessionalSchedulesController,
        'updateWeeklyAvailabilityStatus',
      ])
      .use(
        middleware.clinicPermission({
          permissions: ['schedules.read'],
        })
      )
      .use(middleware.scheduleManagement())

    router
      .post('/schedule-blocks', [ProfessionalSchedulesController, 'storeScheduleBlock'])
      .use(
        middleware.clinicPermission({
          permissions: ['schedules.read'],
        })
      )
      .use(middleware.scheduleManagement())

    router
      .patch('/schedule-blocks/:blockId', [ProfessionalSchedulesController, 'updateScheduleBlock'])
      .use(
        middleware.clinicPermission({
          permissions: ['schedules.read'],
        })
      )
      .use(middleware.scheduleManagement())

    router
      .patch('/schedule-blocks/:blockId/status', [
        ProfessionalSchedulesController,
        'updateScheduleBlockStatus',
      ])
      .use(
        middleware.clinicPermission({
          permissions: ['schedules.read'],
        })
      )
      .use(middleware.scheduleManagement())
  })
  .prefix('/api/v1/clinics/:clinicId/professionals/:professionalId')
  .where('clinicId', router.matchers.uuid())
  .where('professionalId', router.matchers.uuid())
  .where('availabilityId', router.matchers.uuid())
  .where('blockId', router.matchers.uuid())
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )

router
  .group(() => {
    router.get('/', [AppointmentsController, 'index']).use(
      middleware.clinicPermission({
        permissions: ['appointments.read'],
      })
    )

    router
      .post('/', [AppointmentsController, 'store'])
      .use(
        middleware.clinicPermission({
          permissions: ['appointments.read'],
        })
      )
      .use(
        middleware.appointmentManagement({
          action: 'create',
        })
      )

    router.get('/:appointmentId', [AppointmentsController, 'show']).use(
      middleware.clinicPermission({
        permissions: ['appointments.read'],
      })
    )

    router
      .patch('/:appointmentId', [AppointmentsController, 'update'])
      .use(
        middleware.clinicPermission({
          permissions: ['appointments.read'],
        })
      )
      .use(
        middleware.appointmentManagement({
          action: 'update',
        })
      )
    router
      .post('/:appointmentId/confirm', [AppointmentsController, 'confirm'])
      .use(
        middleware.clinicPermission({
          permissions: ['appointments.read'],
        })
      )
      .use(
        middleware.appointmentManagement({
          action: 'changeStatus',
        })
      )

    router
      .post('/:appointmentId/cancel', [AppointmentsController, 'cancel'])
      .use(
        middleware.clinicPermission({
          permissions: ['appointments.read'],
        })
      )
      .use(
        middleware.appointmentManagement({
          action: 'changeStatus',
        })
      )

    router
      .post('/:appointmentId/complete', [AppointmentsController, 'complete'])
      .use(
        middleware.clinicPermission({
          permissions: ['appointments.read'],
        })
      )
      .use(
        middleware.appointmentManagement({
          action: 'changeStatus',
        })
      )

    router
      .post('/:appointmentId/no-show', [AppointmentsController, 'markNoShow'])
      .use(
        middleware.clinicPermission({
          permissions: ['appointments.read'],
        })
      )
      .use(
        middleware.appointmentManagement({
          action: 'changeStatus',
        })
      )

    router
      .post('/:appointmentId/reschedule', [AppointmentsController, 'reschedule'])
      .use(
        middleware.clinicPermission({
          permissions: ['appointments.read'],
        })
      )
      .use(
        middleware.appointmentManagement({
          action: 'reschedule',
        })
      )
  })
  .prefix('/api/v1/clinics/:clinicId/appointments')
  .where('clinicId', router.matchers.uuid())
  .where('appointmentId', router.matchers.uuid())
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )
