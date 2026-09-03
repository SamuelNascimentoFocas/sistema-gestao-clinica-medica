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
const MedicalRecordAttachmentsController = () =>
  import('#controllers/medical_record_attachments_controller')
const AuditLogsController = () => import('#controllers/audit_logs_controller')
const UserClinicsController = () => import('#controllers/user_clinics_controller')
const ClinicMembersController = () => import('#controllers/clinic_members_controller')

const AppointmentStatusController = () => import('#controllers/appointment_status_controller')
const AppointmentReschedulingController = () =>
  import('#controllers/appointment_rescheduling_controller')
const ClinicMemberAccessController = () => import('#controllers/clinic_member_access_controller')
const ClinicMembershipStatusController = () =>
  import('#controllers/clinic_membership_status_controller')
const ClinicStatusController = () => import('#controllers/clinic_status_controller')
const MedicalRecordAttachmentDownloadsController = () =>
  import('#controllers/medical_record_attachment_downloads_controller')
const MedicalRecordEntriesController = () =>
  import('#controllers/medical_record_entries_controller')
const MedicalRecordCorrectionsController = () =>
  import('#controllers/medical_record_corrections_controller')
const PatientLinkStatusController = () => import('#controllers/patient_link_status_controller')
const ProfessionalWeeklyAvailabilitiesController = () =>
  import('#controllers/professional_weekly_availabilities_controller')
const ProfessionalScheduleStatusController = () =>
  import('#controllers/professional_schedule_status_controller')
const ProfessionalScheduleBlocksController = () =>
  import('#controllers/professional_schedule_blocks_controller')
const ProfessionalLinkStatusController = () =>
  import('#controllers/professional_link_status_controller')
const UserStatusController = () => import('#controllers/user_status_controller')

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
    router.get('/me/clinics', [UserClinicsController, 'index'])
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
      .patch('/:id/status', [ClinicStatusController, 'updateStatus'])
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
      .patch('/:id/status', [UserStatusController, 'updateStatus'])
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
      .patch('/:id/status', [ClinicMembershipStatusController, 'updateStatus'])
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
  .get('/api/v1/clinics/:clinicId/members', [ClinicMembersController, 'index'])
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
  .post('/api/v1/clinics/:clinicId/members', [ClinicMembersController, 'store'])
  .where('clinicId', router.matchers.uuid())
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )
  .use(
    middleware.clinicPermission({
      permissions: ['users.create', 'users.assign_role'],
    })
  )

router
  .patch('/api/v1/clinics/:clinicId/members/:membershipId/role', [
    ClinicMemberAccessController,
    'updateRole',
  ])
  .where('clinicId', router.matchers.uuid())
  .where('membershipId', router.matchers.uuid())
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )
  .use(
    middleware.clinicPermission({
      permissions: ['users.assign_role'],
    })
  )

router
  .patch('/api/v1/clinics/:clinicId/members/:membershipId/status', [
    ClinicMemberAccessController,
    'updateStatus',
  ])
  .where('clinicId', router.matchers.uuid())
  .where('membershipId', router.matchers.uuid())
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )
  .use(
    middleware.clinicPermission({
      permissions: ['users.deactivate'],
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

    router.patch('/:patientId/status', [PatientLinkStatusController, 'updateStatus']).use(
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
    router.get('/', [MedicalRecordsController, 'show']).use(
      middleware.clinicPermission({
        permissions: ['patients.read', 'medical_records.read'],
      })
    )

    router.post('/entries', [MedicalRecordEntriesController, 'store']).use(
      middleware.clinicPermission({
        permissions: ['patients.read', 'medical_records.create'],
      })
    )

    router.get('/entries/:entryId', [MedicalRecordEntriesController, 'show']).use(
      middleware.clinicPermission({
        permissions: ['patients.read', 'medical_records.read'],
      })
    )

    router
      .post('/entries/:entryId/corrections', [MedicalRecordCorrectionsController, 'correct'])
      .use(
        middleware.clinicPermission({
          permissions: ['patients.read', 'medical_records.correct'],
        })
      )

    router.get('/entries/:entryId/attachments', [MedicalRecordAttachmentsController, 'index']).use(
      middleware.clinicPermission({
        permissions: ['patients.read', 'attachments.read'],
      })
    )

    router
      .get('/entries/:entryId/attachments/:attachmentId/download', [
        MedicalRecordAttachmentDownloadsController,
        'download',
      ])
      .use(
        middleware.clinicPermission({
          permissions: ['patients.read', 'attachments.read'],
        })
      )

    router.post('/entries/:entryId/attachments', [MedicalRecordAttachmentsController, 'store']).use(
      middleware.clinicPermission({
        permissions: ['patients.read', 'attachments.upload'],
      })
    )
  })
  .prefix('/api/v1/clinics/:clinicId/patients/:patientId/medical-record')
  .where('clinicId', router.matchers.uuid())
  .where('patientId', router.matchers.uuid())
  .where('entryId', router.matchers.uuid())
  .where('attachmentId', router.matchers.uuid())
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

    router.patch('/:professionalId/status', [ProfessionalLinkStatusController, 'updateStatus']).use(
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
      .post('/weekly-availabilities', [ProfessionalWeeklyAvailabilitiesController, 'store'])
      .use(
        middleware.clinicPermission({
          permissions: ['schedules.read'],
        })
      )
      .use(middleware.scheduleManagement())

    router
      .patch('/weekly-availabilities/:availabilityId', [
        ProfessionalWeeklyAvailabilitiesController,
        'update',
      ])
      .use(
        middleware.clinicPermission({
          permissions: ['schedules.read'],
        })
      )
      .use(middleware.scheduleManagement())

    router
      .patch('/weekly-availabilities/:availabilityId/status', [
        ProfessionalScheduleStatusController,
        'updateWeeklyAvailabilityStatus',
      ])
      .use(
        middleware.clinicPermission({
          permissions: ['schedules.read'],
        })
      )
      .use(middleware.scheduleManagement())

    router
      .post('/schedule-blocks', [ProfessionalScheduleBlocksController, 'store'])
      .use(
        middleware.clinicPermission({
          permissions: ['schedules.read'],
        })
      )
      .use(middleware.scheduleManagement())

    router
      .patch('/schedule-blocks/:blockId', [ProfessionalScheduleBlocksController, 'update'])
      .use(
        middleware.clinicPermission({
          permissions: ['schedules.read'],
        })
      )
      .use(middleware.scheduleManagement())

    router
      .patch('/schedule-blocks/:blockId/status', [
        ProfessionalScheduleStatusController,
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
      .post('/:appointmentId/confirm', [AppointmentStatusController, 'confirm'])
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
      .post('/:appointmentId/cancel', [AppointmentStatusController, 'cancel'])
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
      .post('/:appointmentId/complete', [AppointmentStatusController, 'complete'])
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
      .post('/:appointmentId/no-show', [AppointmentStatusController, 'markNoShow'])
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
      .post('/:appointmentId/reschedule', [AppointmentReschedulingController, 'reschedule'])
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

router
  .group(() => {
    router.get('/', [AuditLogsController, 'index']).use(
      middleware.clinicPermission({
        permissions: ['audit_logs.read'],
      })
    )
  })
  .prefix('/api/v1/clinics/:clinicId/audit-logs')
  .where('clinicId', router.matchers.uuid())
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )
