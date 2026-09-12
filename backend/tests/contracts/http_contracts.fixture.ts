export type MiddlewareContract = readonly [name: string, args: unknown]

export type RouteContract = readonly [
  method: string,
  path: string,
  middleware: readonly MiddlewareContract[],
]

interface ContractsFixture {
  domain: string
  routes: readonly RouteContract[]
  validationRules: Readonly<Record<string, string>>
}

type AppointmentAction = 'create' | 'update' | 'changeStatus' | 'reschedule'

const auth = ['auth', { guards: ['api'] }] as const satisfies MiddlewareContract
const globalAdmin = ['globalAdmin', null] as const satisfies MiddlewareContract
const scheduleManagement = ['scheduleManagement', null] as const satisfies MiddlewareContract

function route(
  method: string,
  path: string,
  middleware: readonly MiddlewareContract[] = []
): RouteContract {
  return [method, path, middleware]
}

function secured(...middleware: MiddlewareContract[]) {
  return [auth, ...middleware]
}

function permitted(...permissions: string[]) {
  return secured(['clinicPermission', { permissions }])
}

function managedAppointment(action: AppointmentAction) {
  return secured(
    ['clinicPermission', { permissions: ['appointments.read'] }],
    ['appointmentManagement', { action }]
  )
}

function managedSchedule() {
  return secured(['clinicPermission', { permissions: ['schedules.read'] }], scheduleManagement)
}

const contractsFixture = {
  domain: 'root',
  routes: [
    route('GET', '/'),
    route('POST', '/api/v1/auth/login'),
    route('POST', '/api/v1/invitations/accept'),
    route('POST', '/api/v1/invitations/validate'),
    route('DELETE', '/api/v1/auth/logout', secured()),
    route('GET', '/api/v1/auth/me', secured()),
    route('GET', '/api/v1/auth/me/clinics', secured()),
    route('GET', '/api/v1/clinic-memberships', secured(globalAdmin)),
    route('POST', '/api/v1/clinic-memberships', secured(globalAdmin)),
    route('GET', '/api/v1/clinic-memberships/:id', secured(globalAdmin)),
    route('PATCH', '/api/v1/clinic-memberships/:id', secured(globalAdmin)),
    route('PATCH', '/api/v1/clinic-memberships/:id/status', secured(globalAdmin)),
    route('GET', '/api/v1/clinics', secured(globalAdmin)),
    route('POST', '/api/v1/clinics', secured(globalAdmin)),
    route('GET', '/api/v1/clinics/:clinicId/appointments', permitted('appointments.read')),
    route('POST', '/api/v1/clinics/:clinicId/appointments', managedAppointment('create')),
    route(
      'GET',
      '/api/v1/clinics/:clinicId/appointments/:appointmentId',
      permitted('appointments.read')
    ),
    route(
      'PATCH',
      '/api/v1/clinics/:clinicId/appointments/:appointmentId',
      managedAppointment('update')
    ),
    route(
      'POST',
      '/api/v1/clinics/:clinicId/appointments/:appointmentId/cancel',
      managedAppointment('changeStatus')
    ),
    route(
      'POST',
      '/api/v1/clinics/:clinicId/appointments/:appointmentId/complete',
      managedAppointment('changeStatus')
    ),
    route(
      'POST',
      '/api/v1/clinics/:clinicId/appointments/:appointmentId/confirm',
      managedAppointment('changeStatus')
    ),
    route(
      'POST',
      '/api/v1/clinics/:clinicId/appointments/:appointmentId/no-show',
      managedAppointment('changeStatus')
    ),
    route(
      'POST',
      '/api/v1/clinics/:clinicId/appointments/:appointmentId/reschedule',
      managedAppointment('reschedule')
    ),
    route('GET', '/api/v1/clinics/:clinicId/audit-logs', permitted('audit_logs.read')),
    route('GET', '/api/v1/clinics/:clinicId/context', permitted('clinics.read')),
    route('GET', '/api/v1/clinics/:clinicId/members', permitted('users.read')),
    route(
      'POST',
      '/api/v1/clinics/:clinicId/members/invitations',
      permitted('users.create', 'users.assign_role')
    ),
    route(
      'POST',
      '/api/v1/clinics/:clinicId/members/:membershipId/invitations/resend',
      permitted('users.create')
    ),
    route(
      'PATCH',
      '/api/v1/clinics/:clinicId/members/:membershipId/role',
      permitted('users.assign_role')
    ),
    route(
      'PATCH',
      '/api/v1/clinics/:clinicId/members/:membershipId/status',
      permitted('users.deactivate')
    ),
    route('GET', '/api/v1/clinics/:clinicId/roles/assignable', permitted('users.assign_role')),
    route('GET', '/api/v1/clinics/:clinicId/roles/permissions', permitted('roles.manage')),
    route('GET', '/api/v1/clinics/:clinicId/roles', permitted('roles.manage')),
    route('POST', '/api/v1/clinics/:clinicId/roles', permitted('roles.manage')),
    route('GET', '/api/v1/clinics/:clinicId/roles/:roleId', permitted('roles.manage')),
    route('PATCH', '/api/v1/clinics/:clinicId/roles/:roleId', permitted('roles.manage')),
    route('PATCH', '/api/v1/clinics/:clinicId/roles/:roleId/status', permitted('roles.manage')),
    route('GET', '/api/v1/clinics/:clinicId/patients', permitted('patients.read')),
    route('POST', '/api/v1/clinics/:clinicId/patients', permitted('patients.create')),
    route('GET', '/api/v1/clinics/:clinicId/patients/:patientId', permitted('patients.read')),
    route('PATCH', '/api/v1/clinics/:clinicId/patients/:patientId', permitted('patients.update')),
    route(
      'GET',
      '/api/v1/clinics/:clinicId/patients/:patientId/medical-record',
      permitted('patients.read', 'medical_records.read')
    ),
    route(
      'POST',
      '/api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries',
      permitted('patients.read', 'medical_records.create')
    ),
    route(
      'GET',
      '/api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId',
      permitted('patients.read', 'medical_records.read')
    ),
    route(
      'GET',
      '/api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId/attachments',
      permitted('patients.read', 'attachments.read')
    ),
    route(
      'POST',
      '/api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId/attachments',
      permitted('patients.read', 'attachments.upload')
    ),
    route(
      'GET',
      '/api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId/attachments/:attachmentId/download',
      permitted('patients.read', 'attachments.read')
    ),
    route(
      'POST',
      '/api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId/corrections',
      permitted('patients.read', 'medical_records.correct')
    ),
    route(
      'PATCH',
      '/api/v1/clinics/:clinicId/patients/:patientId/status',
      permitted('patients.update')
    ),
    route('GET', '/api/v1/clinics/:clinicId/professionals', permitted('professionals.read')),
    route('POST', '/api/v1/clinics/:clinicId/professionals', permitted('professionals.create')),
    route(
      'GET',
      '/api/v1/clinics/:clinicId/professionals/:professionalId',
      permitted('professionals.read')
    ),
    route(
      'PATCH',
      '/api/v1/clinics/:clinicId/professionals/:professionalId',
      permitted('professionals.update')
    ),
    route(
      'GET',
      '/api/v1/clinics/:clinicId/professionals/:professionalId/schedule',
      permitted('schedules.read')
    ),
    route(
      'POST',
      '/api/v1/clinics/:clinicId/professionals/:professionalId/schedule-blocks',
      managedSchedule()
    ),
    route(
      'PATCH',
      '/api/v1/clinics/:clinicId/professionals/:professionalId/schedule-blocks/:blockId',
      managedSchedule()
    ),
    route(
      'PATCH',
      '/api/v1/clinics/:clinicId/professionals/:professionalId/schedule-blocks/:blockId/status',
      managedSchedule()
    ),
    route(
      'PATCH',
      '/api/v1/clinics/:clinicId/professionals/:professionalId/status',
      permitted('professionals.update')
    ),
    route(
      'POST',
      '/api/v1/clinics/:clinicId/professionals/:professionalId/weekly-availabilities',
      managedSchedule()
    ),
    route(
      'PATCH',
      '/api/v1/clinics/:clinicId/professionals/:professionalId/weekly-availabilities/:availabilityId',
      managedSchedule()
    ),
    route(
      'PATCH',
      '/api/v1/clinics/:clinicId/professionals/:professionalId/weekly-availabilities/:availabilityId/status',
      managedSchedule()
    ),
    route('GET', '/api/v1/clinics/:id', secured(globalAdmin)),
    route('PATCH', '/api/v1/clinics/:id', secured(globalAdmin)),
    route('PATCH', '/api/v1/clinics/:id/status', secured(globalAdmin)),
    route('GET', '/api/v1/users', secured(globalAdmin)),
    route('POST', '/api/v1/users/invitations', secured(globalAdmin)),
    route('POST', '/api/v1/users/:userId/invitations/resend', secured(globalAdmin)),
    route('GET', '/api/v1/users/:id', secured(globalAdmin)),
    route('PATCH', '/api/v1/users/:id', secured(globalAdmin)),
    route('PATCH', '/api/v1/users/:id/status', secured(globalAdmin)),
  ],
  validationRules: {
    'root GET /api/v1/clinic-memberships:query':
      '1c4c7c915fde90aa83bc6b7c927fa750ef51bf7f8df4bdeaf1ff8705dd6fff69',
    'root GET /api/v1/clinics/:clinicId/appointments:query':
      'd9899ea998ac0e2428aa98460fbc6afb7943c01b826c0e0cecca70cbdac72556',
    'root GET /api/v1/clinics/:clinicId/audit-logs:query':
      '2c32574ef234836c4b2b48c4d292055bfbe1ac2411eee087f35a8043bcbca37d',
    'root GET /api/v1/clinics/:clinicId/members:query':
      'f07c775267c3afebb987888126fbb002961972dff746883ee4ca2d7cb825f861',
    'root GET /api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId/attachments/:attachmentId/download:query':
      'e30718445cbc3972e457ed7681f45c64295c55625f923d25082fd89adc61c29e',
    'root GET /api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId/attachments:query':
      'e30718445cbc3972e457ed7681f45c64295c55625f923d25082fd89adc61c29e',
    'root GET /api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId:query':
      'e30718445cbc3972e457ed7681f45c64295c55625f923d25082fd89adc61c29e',
    'root GET /api/v1/clinics/:clinicId/patients/:patientId/medical-record:query':
      'e30718445cbc3972e457ed7681f45c64295c55625f923d25082fd89adc61c29e',
    'root GET /api/v1/clinics/:clinicId/patients:query':
      'e3b9c5d8312013a6f4e2e3a730e70a945be43cbd4c2dd259ebd5914f7331cd0a',
    'root GET /api/v1/clinics/:clinicId/professionals:query':
      '0d077f07b62cad47e1fd8282f92513f0f189101b4ecadd6f157d637a4ab8157a',
    'root GET /api/v1/clinics:query':
      'e3b9c5d8312013a6f4e2e3a730e70a945be43cbd4c2dd259ebd5914f7331cd0a',
    'root GET /api/v1/users:query':
      '818e5b4513256f9801fc0eb92e51a19530c570599dbb4fa3cf5019eb020e7ea6',
    'root PATCH /api/v1/clinic-memberships/:id/status:body':
      'c46d433ee4ce6e09977de3cbecd885476eeba01b2b06db90d21be2555c2fa0cc',
    'root PATCH /api/v1/clinic-memberships/:id:body':
      '2b7d7fa4bf5ed00d0f9adbc74d22d852946fcbebae2478b047f1bc058f045888',
    'root PATCH /api/v1/clinics/:clinicId/appointments/:appointmentId:body':
      'dbfe25b1dadde4229e428ea7e32ef3050ab684b4587e0f2312c9aec64f473c12',
    'root PATCH /api/v1/clinics/:clinicId/members/:membershipId/role:body':
      '2b7d7fa4bf5ed00d0f9adbc74d22d852946fcbebae2478b047f1bc058f045888',
    'root PATCH /api/v1/clinics/:clinicId/members/:membershipId/status:body':
      'c46d433ee4ce6e09977de3cbecd885476eeba01b2b06db90d21be2555c2fa0cc',
    'root PATCH /api/v1/clinics/:clinicId/patients/:patientId/status:body':
      'c46d433ee4ce6e09977de3cbecd885476eeba01b2b06db90d21be2555c2fa0cc',
    'root PATCH /api/v1/clinics/:clinicId/patients/:patientId:body':
      '2f0b5d97058a503939167ad16be745ac453583ce6671e204065df930d794d691',
    'root PATCH /api/v1/clinics/:clinicId/professionals/:professionalId/schedule-blocks/:blockId/status:body':
      'e574d0e603c46fa06342ff9b16634106f9cd12cbf648908f131c820b22c8d957',
    'root PATCH /api/v1/clinics/:clinicId/professionals/:professionalId/schedule-blocks/:blockId:body':
      'c6d3d2f5417cb5b9d5cabfa3b1bd32c2b428e2e9d47ed60fd0733d586c382e5f',
    'root PATCH /api/v1/clinics/:clinicId/professionals/:professionalId/status:body':
      'c46d433ee4ce6e09977de3cbecd885476eeba01b2b06db90d21be2555c2fa0cc',
    'root PATCH /api/v1/clinics/:clinicId/professionals/:professionalId/weekly-availabilities/:availabilityId/status:body':
      'e574d0e603c46fa06342ff9b16634106f9cd12cbf648908f131c820b22c8d957',
    'root PATCH /api/v1/clinics/:clinicId/professionals/:professionalId/weekly-availabilities/:availabilityId:body':
      '56458c376d39b00580e52a3b1f8cc44094cb2c4e4d9a79ade71eb7ff43d5ad32',
    'root PATCH /api/v1/clinics/:clinicId/professionals/:professionalId:body':
      '94d36059f790a0e4ed006907c8f7c7e93435f85f3731e4d80a5e35f709ae20f6',
    'root PATCH /api/v1/clinics/:clinicId/roles/:roleId/status:body':
      'c568990600b572e74e0f2f213125104b41a7f0a09e0988b9e19b396d2a5b7a5d',
    'root PATCH /api/v1/clinics/:clinicId/roles/:roleId:body':
      '481ac941e7833b8d984c9e48bf406591585b36d8abf5b15625ba3a8c5f31dcbe',
    'root PATCH /api/v1/clinics/:id/status:body':
      'c46d433ee4ce6e09977de3cbecd885476eeba01b2b06db90d21be2555c2fa0cc',
    'root PATCH /api/v1/clinics/:id:body':
      '823263b77a7e8650204f79b93802ba30069f035ec21358ef0bb44b9167287a37',
    'root PATCH /api/v1/users/:id/status:body':
      'c46d433ee4ce6e09977de3cbecd885476eeba01b2b06db90d21be2555c2fa0cc',
    'root PATCH /api/v1/users/:id:body':
      'e0c4bdee30ff0df082b6a169dd36a0a3d4661e09b473ecdeae9bdcad84941cf2',
    'root POST /api/v1/auth/login:body':
      'd9ab1c36334474e8d943ac653526e431478882bbdc9e7b851485dbf98de34389',
    'root POST /api/v1/clinic-memberships:body':
      'fd3b92a3e309916d3c676ee27bf3d652e2ba7451357fcf77b93e22615742db3f',
    'root POST /api/v1/clinics/:clinicId/appointments/:appointmentId/cancel:body':
      '7f81136db757c6febc64547eefd1c0a5632c11efc4affff0b9e6284473e01744',
    'root POST /api/v1/clinics/:clinicId/appointments/:appointmentId/complete:body':
      '0f57ac73460c2cd0525e455928626e0c9a8386fd277dff975842dc69722c19f2',
    'root POST /api/v1/clinics/:clinicId/appointments/:appointmentId/confirm:body':
      '0f57ac73460c2cd0525e455928626e0c9a8386fd277dff975842dc69722c19f2',
    'root POST /api/v1/clinics/:clinicId/appointments/:appointmentId/no-show:body':
      '0f57ac73460c2cd0525e455928626e0c9a8386fd277dff975842dc69722c19f2',
    'root POST /api/v1/clinics/:clinicId/appointments/:appointmentId/reschedule:body':
      '13837c29bbf83bc62790d2c0a4563e6f1efe2bc186924fa22c55ce05b08c85b5',
    'root POST /api/v1/clinics/:clinicId/appointments:body':
      'b1c92d8f7aac0d407665b4632b823e8e1a2e133551efc9e365d5c39f66bc5533',
    'root POST /api/v1/clinics/:clinicId/members/invitations:body':
      'c18d224e029f41c45a8ff8789a94ffa4b6a5c4308ab179973e5a4a2f7f8add74',
    'root POST /api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId/attachments:body':
      '06f3de8980d9ca3e6297d3f3b953771119046b6f143229e2395baefbb7ce93a3',
    'root POST /api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries/:entryId/corrections:body':
      'ffcc3a7e04597dcb813cba7af541ee694153a5b75809a7bd7b7c225cc0ebcd95',
    'root POST /api/v1/clinics/:clinicId/patients/:patientId/medical-record/entries:body':
      'feb6604b7724edfe0cb8d128f60f4fb443868c10ab3d46c66c337820195cc8d1',
    'root POST /api/v1/clinics/:clinicId/patients:body':
      '0e4c55fb77a12dfafb51ce6ea9b35c1270e962cb92990a3f5c68e23e8caa6981',
    'root POST /api/v1/clinics/:clinicId/professionals/:professionalId/schedule-blocks:body':
      '216aa5bac9da9eba047a03c5db52d421af903e98d601fb7c6ee9b82a2c222116',
    'root POST /api/v1/clinics/:clinicId/professionals/:professionalId/weekly-availabilities:body':
      '5f94209252ab20dcd223fbf0803861966018e34b09173bb4b153fb4a1a342e09',
    'root POST /api/v1/clinics/:clinicId/professionals:body':
      '413a1358cf67976488ddcb8a22645f5105b0f2532e06e01b26bc9187f39b7052',
    'root POST /api/v1/clinics/:clinicId/roles:body':
      '481ac941e7833b8d984c9e48bf406591585b36d8abf5b15625ba3a8c5f31dcbe',
    'root POST /api/v1/clinics:body':
      '1ebb9ec8352ad05377a644eac4a3d9dac994ea3943fefb3560378a9b7bd895b9',
    'root POST /api/v1/invitations/accept:body':
      'e4bd03b527c3fe640cfdaee34f3611cf90d78b11825bc3f204183bdb4810929f',
    'root POST /api/v1/invitations/validate:body':
      '0818ae2a0605dab433c09e33f242d331bf65f236f206fd2984a1e03c6ddb0f5b',
    'root POST /api/v1/users/invitations:body':
      '17ffb62da8cf8fb4561993dfbd82ef3dcc2a0123dd62658b5546f5a2182cb404',
  },
} as const satisfies ContractsFixture

export default contractsFixture
