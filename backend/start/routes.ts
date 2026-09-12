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
const ClinicRolesController = () => import('#controllers/clinic_roles_controller')
const InvitationsController = () => import('#controllers/invitations_controller')
const UserInvitationsController = () => import('#controllers/user_invitations_controller')
const ClinicMemberInvitationsController = () =>
  import('#controllers/clinic_member_invitations_controller')

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
const ClinicRoleStatusController = () => import('#controllers/clinic_role_status_controller')
const ClinicRolePermissionsController = () =>
  import('#controllers/clinic_role_permissions_controller')
const AssignableClinicRolesController = () =>
  import('#controllers/assignable_clinic_roles_controller')

router.get('/', async () => {
  return {
    name: 'Clinic Management API',
    status: 'ok',
  }
})

router
  .group(() => {
    // Login permanece público.
    router
      .group(() => {
        router.post('/login', [SessionsController, 'store'])
      })
      .prefix('/auth')

    router
      .group(() => {
        router.post('/validate', [InvitationsController, 'validate'])
        router.post('/accept', [InvitationsController, 'accept'])
      })
      .prefix('/invitations')

    // Todas as demais rotas da API exigem autenticação.
    router
      .group(() => {
        router
          .group(() => {
            router.get('/me/clinics', [UserClinicsController, 'index'])
            router.get('/me', [SessionsController, 'show'])
            router.delete('/logout', [SessionsController, 'destroy'])
          })
          .prefix('/auth')

        // Administração global: somente os três recursos administrativos.
        router
          .group(() => {
            router
              .group(() => {
                router.get('/', [ClinicsController, 'index'])
                router.post('/', [ClinicsController, 'store'])

                router.get('/:id', [ClinicsController, 'show']).where('id', router.matchers.uuid())

                router
                  .patch('/:id', [ClinicsController, 'update'])
                  .where('id', router.matchers.uuid())

                router
                  .patch('/:id/status', [ClinicStatusController, 'updateStatus'])
                  .where('id', router.matchers.uuid())
              })
              .prefix('/clinics')

            router
              .group(() => {
                router.get('/', [UsersController, 'index'])
                router.post('/invitations', [UserInvitationsController, 'store'])

                router
                  .post('/:userId/invitations/resend', [UserInvitationsController, 'resend'])
                  .where('userId', router.matchers.uuid())

                router.get('/:id', [UsersController, 'show']).where('id', router.matchers.uuid())

                router
                  .patch('/:id', [UsersController, 'update'])
                  .where('id', router.matchers.uuid())

                router
                  .patch('/:id/status', [UserStatusController, 'updateStatus'])
                  .where('id', router.matchers.uuid())
              })
              .prefix('/users')

            router
              .group(() => {
                router.get('/', [ClinicMembershipsController, 'index'])
                router.post('/', [ClinicMembershipsController, 'store'])

                router
                  .get('/:id', [ClinicMembershipsController, 'show'])
                  .where('id', router.matchers.uuid())

                router
                  .patch('/:id', [ClinicMembershipsController, 'update'])
                  .where('id', router.matchers.uuid())

                router
                  .patch('/:id/status', [ClinicMembershipStatusController, 'updateStatus'])
                  .where('id', router.matchers.uuid())
              })
              .prefix('/clinic-memberships')
          })
          .use(middleware.globalAdmin())

        // Contexto clínico: permissões específicas permanecem em cada módulo/rota.
        router
          .group(() => {
            router.get('/context', [ClinicContextsController, 'show']).use(
              middleware.clinicPermission({
                permissions: ['clinics.read'],
              })
            )

            router.get('/members', [ClinicMembersController, 'index']).use(
              middleware.clinicPermission({
                permissions: ['users.read'],
              })
            )

            router.post('/members/invitations', [ClinicMemberInvitationsController, 'store']).use(
              middleware.clinicPermission({
                permissions: ['users.create', 'users.assign_role'],
              })
            )

            router
              .post('/members/:membershipId/invitations/resend', [
                ClinicMemberInvitationsController,
                'resend',
              ])
              .where('membershipId', router.matchers.uuid())
              .use(
                middleware.clinicPermission({
                  permissions: ['users.create'],
                })
              )

            router
              .patch('/members/:membershipId/role', [ClinicMemberAccessController, 'updateRole'])
              .where('membershipId', router.matchers.uuid())
              .use(
                middleware.clinicPermission({
                  permissions: ['users.assign_role'],
                })
              )

            router
              .patch('/members/:membershipId/status', [
                ClinicMemberAccessController,
                'updateStatus',
              ])
              .where('membershipId', router.matchers.uuid())
              .use(
                middleware.clinicPermission({
                  permissions: ['users.deactivate'],
                })
              )

            router.get('/roles/assignable', [AssignableClinicRolesController, 'index']).use(
              middleware.clinicPermission({
                permissions: ['users.assign_role'],
              })
            )

            router.get('/roles/permissions', [ClinicRolePermissionsController, 'index']).use(
              middleware.clinicPermission({
                permissions: ['roles.manage'],
              })
            )

            router
              .group(() => {
                router.get('/', [ClinicRolesController, 'index'])
                router.post('/', [ClinicRolesController, 'store'])
                router.get('/:roleId', [ClinicRolesController, 'show'])
                router.patch('/:roleId', [ClinicRolesController, 'update'])
                router.patch('/:roleId/status', [ClinicRoleStatusController, 'updateStatus'])
              })
              .prefix('/roles')
              .where('roleId', router.matchers.uuid())
              .use(
                middleware.clinicPermission({
                  permissions: ['roles.manage'],
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

                router
                  .patch('/:patientId/status', [PatientLinkStatusController, 'updateStatus'])
                  .use(
                    middleware.clinicPermission({
                      permissions: ['patients.update'],
                    })
                  )
              })
              .prefix('/patients')
              .where('patientId', router.matchers.uuid())

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
                  .post('/entries/:entryId/corrections', [
                    MedicalRecordCorrectionsController,
                    'correct',
                  ])
                  .use(
                    middleware.clinicPermission({
                      permissions: ['patients.read', 'medical_records.correct'],
                    })
                  )

                router
                  .get('/entries/:entryId/attachments', [
                    MedicalRecordAttachmentsController,
                    'index',
                  ])
                  .use(
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

                router
                  .post('/entries/:entryId/attachments', [
                    MedicalRecordAttachmentsController,
                    'store',
                  ])
                  .use(
                    middleware.clinicPermission({
                      permissions: ['patients.read', 'attachments.upload'],
                    })
                  )
              })
              .prefix('/patients/:patientId/medical-record')
              .where('patientId', router.matchers.uuid())
              .where('entryId', router.matchers.uuid())
              .where('attachmentId', router.matchers.uuid())

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

                router
                  .patch('/:professionalId/status', [
                    ProfessionalLinkStatusController,
                    'updateStatus',
                  ])
                  .use(
                    middleware.clinicPermission({
                      permissions: ['professionals.update'],
                    })
                  )
              })
              .prefix('/professionals')
              .where('professionalId', router.matchers.uuid())

            router
              .group(() => {
                router.get('/schedule', [ProfessionalSchedulesController, 'show'])

                router
                  .post('/weekly-availabilities', [
                    ProfessionalWeeklyAvailabilitiesController,
                    'store',
                  ])
                  .use(middleware.scheduleManagement())

                router
                  .patch('/weekly-availabilities/:availabilityId', [
                    ProfessionalWeeklyAvailabilitiesController,
                    'update',
                  ])
                  .use(middleware.scheduleManagement())

                router
                  .patch('/weekly-availabilities/:availabilityId/status', [
                    ProfessionalScheduleStatusController,
                    'updateWeeklyAvailabilityStatus',
                  ])
                  .use(middleware.scheduleManagement())

                router
                  .post('/schedule-blocks', [ProfessionalScheduleBlocksController, 'store'])
                  .use(middleware.scheduleManagement())

                router
                  .patch('/schedule-blocks/:blockId', [
                    ProfessionalScheduleBlocksController,
                    'update',
                  ])
                  .use(middleware.scheduleManagement())

                router
                  .patch('/schedule-blocks/:blockId/status', [
                    ProfessionalScheduleStatusController,
                    'updateScheduleBlockStatus',
                  ])
                  .use(middleware.scheduleManagement())
              })
              .prefix('/professionals/:professionalId')
              .where('professionalId', router.matchers.uuid())
              .where('availabilityId', router.matchers.uuid())
              .where('blockId', router.matchers.uuid())
              .use(middleware.clinicPermission({ permissions: ['schedules.read'] }))

            router
              .group(() => {
                router.get('/', [AppointmentsController, 'index'])

                router.post('/', [AppointmentsController, 'store']).use(
                  middleware.appointmentManagement({
                    action: 'create',
                  })
                )

                router.get('/:appointmentId', [AppointmentsController, 'show'])

                router.patch('/:appointmentId', [AppointmentsController, 'update']).use(
                  middleware.appointmentManagement({
                    action: 'update',
                  })
                )

                router
                  .post('/:appointmentId/confirm', [AppointmentStatusController, 'confirm'])
                  .use(
                    middleware.appointmentManagement({
                      action: 'changeStatus',
                    })
                  )

                router.post('/:appointmentId/cancel', [AppointmentStatusController, 'cancel']).use(
                  middleware.appointmentManagement({
                    action: 'changeStatus',
                  })
                )

                router
                  .post('/:appointmentId/complete', [AppointmentStatusController, 'complete'])
                  .use(
                    middleware.appointmentManagement({
                      action: 'changeStatus',
                    })
                  )

                router
                  .post('/:appointmentId/no-show', [AppointmentStatusController, 'markNoShow'])
                  .use(
                    middleware.appointmentManagement({
                      action: 'changeStatus',
                    })
                  )

                router
                  .post('/:appointmentId/reschedule', [
                    AppointmentReschedulingController,
                    'reschedule',
                  ])
                  .use(
                    middleware.appointmentManagement({
                      action: 'reschedule',
                    })
                  )
              })
              .prefix('/appointments')
              .where('appointmentId', router.matchers.uuid())
              .use(middleware.clinicPermission({ permissions: ['appointments.read'] }))

            router
              .group(() => {
                router.get('/', [AuditLogsController, 'index']).use(
                  middleware.clinicPermission({
                    permissions: ['audit_logs.read'],
                  })
                )
              })
              .prefix('/audit-logs')
          })
          .prefix('/clinics/:clinicId')
          .where('clinicId', router.matchers.uuid())
      })
      .use(middleware.auth({ guards: ['api'] }))
  })
  .prefix('/api/v1')
