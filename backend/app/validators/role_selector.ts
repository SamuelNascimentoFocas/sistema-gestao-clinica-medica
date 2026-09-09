import vine from '@vinejs/vine'

export function requiredRoleIdGroup() {
  return vine
    .group([
      vine.group.if((data) => data.roleCode === undefined, {
        roleId: vine.string().uuid(),
      }),
    ])
    .otherwise((_, field) => {
      field.report('Informe o perfil exclusivamente por roleId', 'roleId', field)
    })
}

export function optionalRoleIdGroup() {
  return vine
    .group([
      vine.group.if((data) => data.roleCode === undefined, {
        roleId: vine.string().uuid().optional(),
      }),
    ])
    .otherwise((_, field) => {
      field.report('Filtre o perfil exclusivamente por roleId', 'roleId', field)
    })
}
