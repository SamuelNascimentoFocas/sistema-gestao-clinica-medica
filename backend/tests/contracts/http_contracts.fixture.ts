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
      '/api/v1/clinics/:clinicId/members',
      permitted('users.create', 'users.assign_role')
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
    route('POST', '/api/v1/users', secured(globalAdmin)),
    route('GET', '/api/v1/users/:id', secured(globalAdmin)),
    route('PATCH', '/api/v1/users/:id', secured(globalAdmin)),
    route('PATCH', '/api/v1/users/:id/status', secured(globalAdmin)),
  ],
  validationRules: {
    'root GET /api/v1/clinic-memberships:query':
      '15ddb51beb8c9a8a394bcfef1b57cf562a672176c2cfe498e0c881fdaec2f49e',
    'root GET /api/v1/clinics/:clinicId/appointments:query':
      'd9899ea998ac0e2428aa98460fbc6afb7943c01b826c0e0cecca70cbdac72556',
    'root GET /api/v1/clinics/:clinicId/audit-logs:query':
      '2c32574ef234836c4b2b48c4d292055bfbe1ac2411eee087f35a8043bcbca37d',
    'root GET /api/v1/clinics/:clinicId/members:query':
      'df74892863be3f6f6bd25f300c6ab182dd77e458741aca299ce505c198d3d8f5',
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
      'c7908cfe541a0f0de3ae632f977f30d280edc754f0bba6b26332a48d50c40e5e',
    'root PATCH /api/v1/clinics/:clinicId/appointments/:appointmentId:body':
      'dbfe25b1dadde4229e428ea7e32ef3050ab684b4587e0f2312c9aec64f473c12',
    'root PATCH /api/v1/clinics/:clinicId/members/:membershipId/role:body':
      'c7908cfe541a0f0de3ae632f977f30d280edc754f0bba6b26332a48d50c40e5e',
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
    'root PATCH /api/v1/clinics/:id/status:body':
      'c46d433ee4ce6e09977de3cbecd885476eeba01b2b06db90d21be2555c2fa0cc',
    'root PATCH /api/v1/clinics/:id:body':
      '823263b77a7e8650204f79b93802ba30069f035ec21358ef0bb44b9167287a37',
    'root PATCH /api/v1/users/:id/status:body':
      'c46d433ee4ce6e09977de3cbecd885476eeba01b2b06db90d21be2555c2fa0cc',
    'root PATCH /api/v1/users/:id:body':
      'c5c522e3f63118d2cff03610e6b01ea70eac65675b8df5e32c06d064c57179ec',
    'root POST /api/v1/auth/login:body':
      'd9ab1c36334474e8d943ac653526e431478882bbdc9e7b851485dbf98de34389',
    'root POST /api/v1/clinic-memberships:body':
      'e99f463e8373465e188ee9dd03eb9676b5b7233f019632fd7fe37c4fabe02b21',
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
    'root POST /api/v1/clinics/:clinicId/members:body':
      'eece6fa9274642044b7f94fc4fece9667e256318513ffa1c89403171bbcdd8a8',
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
    'root POST /api/v1/clinics:body':
      '1ebb9ec8352ad05377a644eac4a3d9dac994ea3943fefb3560378a9b7bd895b9',
    'root POST /api/v1/users:body':
      '038415e3186e44769e42deb9e599ecca3dda5b54d05529954d030d031bb4c9d9',
  },
} as const satisfies ContractsFixture

export default contractsFixture
