import vine from '@vinejs/vine'

export const SYSTEM_ROLE_CODES = ['clinic_admin', 'receptionist', 'doctor'] as const

export function requiredRoleSelectorGroup() {
  return vine
    .group([
      vine.group.if((data) => typeof data.roleId === 'string' && data.roleCode === undefined, {
        roleId: vine.string().uuid(),
      }),
      vine.group.if((data) => typeof data.roleCode === 'string' && data.roleId === undefined, {
        roleCode: vine.enum(SYSTEM_ROLE_CODES),
      }),
    ])
    .otherwise((_, field) => {
      field.report('Informe exatamente um identificador de perfil', 'roleSelector', field)
    })
}

export function optionalRoleSelectorGroup() {
  return vine
    .group([
      vine.group.if((data) => data.roleId === undefined && data.roleCode === undefined, {
        roleId: vine.string().uuid().optional(),
        roleCode: vine.enum(SYSTEM_ROLE_CODES).optional(),
      }),
      vine.group.if((data) => typeof data.roleId === 'string' && data.roleCode === undefined, {
        roleId: vine.string().uuid(),
      }),
      vine.group.if((data) => typeof data.roleCode === 'string' && data.roleId === undefined, {
        roleCode: vine.enum(SYSTEM_ROLE_CODES),
      }),
    ])
    .otherwise((_, field) => {
      field.report('Use no máximo um filtro de perfil', 'roleSelector', field)
    })
}
