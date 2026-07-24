import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'
import Role from '#models/role'

export const PERMISSIONS = [
  {
    code: 'clinics.read',
    description: 'Visualizar consultórios',
  },
  {
    code: 'clinics.create',
    description: 'Cadastrar consultórios',
  },
  {
    code: 'clinics.update',
    description: 'Atualizar consultórios',
  },
  {
    code: 'clinics.deactivate',
    description: 'Ativar ou inativar consultórios',
  },

  {
    code: 'users.read',
    description: 'Visualizar usuários',
  },
  {
    code: 'users.create',
    description: 'Cadastrar usuários',
  },
  {
    code: 'users.update',
    description: 'Atualizar usuários',
  },
  {
    code: 'users.assign_role',
    description: 'Atribuir perfis aos usuários',
  },
  {
    code: 'users.deactivate',
    description: 'Ativar ou inativar usuários',
  },

  {
    code: 'patients.read',
    description: 'Visualizar pacientes',
  },
  {
    code: 'patients.create',
    description: 'Cadastrar pacientes',
  },
  {
    code: 'patients.update',
    description: 'Atualizar pacientes',
  },

  {
    code: 'professionals.read',
    description: 'Visualizar profissionais',
  },
  {
    code: 'professionals.create',
    description: 'Cadastrar profissionais',
  },
  {
    code: 'professionals.update',
    description: 'Atualizar profissionais',
  },

  {
    code: 'schedules.read',
    description: 'Visualizar horários de atendimento',
  },
  {
    code: 'schedules.manage',
    description: 'Gerenciar horários de atendimento',
  },
  {
    code: 'schedules.manage_own',
    description: 'Gerenciar a própria agenda profissional',
  },

  {
    code: 'appointments.read',
    description: 'Visualizar agendamentos',
  },
  {
    code: 'appointments.create',
    description: 'Cadastrar agendamentos',
  },
  {
    code: 'appointments.update',
    description: 'Atualizar agendamentos',
  },
  {
    code: 'appointments.change_status',
    description: 'Alterar o status de agendamentos',
  },
  {
    code: 'appointments.change_status_own',
    description: 'Alterar o status dos agendamentos do próprio profissional',
  },

  {
    code: 'medical_records.read',
    description: 'Visualizar prontuários',
  },
  {
    code: 'medical_records.create',
    description: 'Registrar entradas em prontuários',
  },
  {
    code: 'medical_records.correct',
    description: 'Registrar correções em prontuários',
  },

  {
    code: 'attachments.read',
    description: 'Visualizar anexos clínicos',
  },
  {
    code: 'attachments.upload',
    description: 'Enviar anexos clínicos',
  },

  {
    code: 'audit_logs.read',
    description: 'Visualizar registros de auditoria',
  },
]

const RECEPTIONIST_PERMISSIONS = [
  'clinics.read',
  'patients.read',
  'patients.create',
  'patients.update',
  'professionals.read',
  'schedules.read',
  'appointments.read',
  'appointments.create',
  'appointments.update',
  'appointments.change_status',
]

const DOCTOR_PERMISSIONS = [
  'clinics.read',
  'patients.read',
  'professionals.read',
  'schedules.read',
  'schedules.manage_own',
  'appointments.read',
  'appointments.change_status_own',
  'medical_records.read',
  'medical_records.create',
  'medical_records.correct',
  'attachments.read',
  'attachments.upload',
]

const ROLE_DEFINITIONS = [
  {
    code: 'clinic_admin',
    name: 'Administrador de Consultório',
    description: 'Gerencia usuários, configurações e operações do consultório',
    permissionCodes: PERMISSIONS.map((permission) => permission.code),
  },
  {
    code: 'receptionist',
    name: 'Recepcionista',
    description: 'Gerencia pacientes e agendamentos administrativos',
    permissionCodes: RECEPTIONIST_PERMISSIONS,
  },
  {
    code: 'doctor',
    name: 'Médico',
    description: 'Realiza atendimentos e registra informações clínicas',
    permissionCodes: DOCTOR_PERMISSIONS,
  },
]

export async function seedAuthorizationCatalog() {
  const permissions = await Permission.updateOrCreateMany(
    'code',
    PERMISSIONS.map((permission) => ({
      ...permission,
      isActive: true,
    }))
  )

  const permissionsByCode = new Map(permissions.map((permission) => [permission.code, permission]))

  const roles = await Role.updateOrCreateMany(
    'code',
    ROLE_DEFINITIONS.map(({ permissionCodes, ...role }) => ({
      ...role,
      isSystem: true,
      isActive: true,
    }))
  )

  for (const definition of ROLE_DEFINITIONS) {
    const role = roles.find((candidate) => candidate.code === definition.code)

    if (!role) {
      throw new Error(`Perfil não encontrado após o seeding: ${definition.code}`)
    }

    const permissionIds = definition.permissionCodes.map((code) => {
      const permission = permissionsByCode.get(code)

      if (!permission) {
        throw new Error(`Permissão não encontrada após o seeding: ${code}`)
      }

      return permission.id
    })

    await role.related('permissions').sync(permissionIds)
  }
}

export default class AuthorizationCatalogSeeder extends BaseSeeder {
  async run() {
    await seedAuthorizationCatalog()
  }
}
