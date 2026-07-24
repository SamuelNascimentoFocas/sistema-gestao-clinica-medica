import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import ClinicProfessional from '#models/clinic_professional'
import Professional from '#models/professional'
import User from '#models/user'
import UserClinicRole from '#models/user_clinic_role'
import {
  createProfessionalValidator,
  listProfessionalsValidator,
  updateProfessionalLinkStatusValidator,
  updateProfessionalLinkValidator,
} from '#validators/professional'

class ProfessionalConflictError extends Error {}

type PostgreSqlError = {
  code?: string
  constraint?: string
}

function getUniqueConstraint(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return null
  }

  const databaseError = error as PostgreSqlError

  if (databaseError.code !== '23505') {
    return null
  }

  return databaseError.constraint ?? null
}

function conflictMessageForConstraint(constraint: string | null) {
  switch (constraint) {
    case 'professionals_user_unique':
      return 'Esta conta de usuário já está vinculada a outro profissional'

    case 'professionals_crm_unique':
      return 'Já existe um profissional cadastrado com este CRM'

    case 'clinic_professionals_clinic_professional_unique':
      return 'Este profissional já está vinculado ao consultório'

    case 'clinic_professionals_local_code_unique':
      return 'Este código local já está em uso no consultório'

    default:
      return null
  }
}

function normalizeComparable(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR')
}

async function loadProfessionalLink({
  clinicId,
  professionalId,
}: {
  clinicId: string
  professionalId: string
}) {
  return ClinicProfessional.query()
    .where('clinic_id', clinicId)
    .where('professional_id', professionalId)
    .preload('clinic')
    .preload('professional', (professionalQuery) => {
      professionalQuery.preload('user')
    })
    .preload('weeklyAvailabilities', (availabilityQuery) => {
      availabilityQuery.orderBy('weekday', 'asc').orderBy('start_time', 'asc')
    })
    .preload('scheduleBlocks', (blockQuery) => {
      blockQuery.orderBy('starts_at', 'asc')
    })
    .first()
}

export default class ProfessionalsController {
  async index({ clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const filters = await listProfessionalsValidator.validate(request.qs())

    const page = filters.page ?? 1
    const perPage = filters.perPage ?? 20

    const query = ClinicProfessional.query()
      .where('clinic_id', clinicAuthorization.clinic.id)
      .preload('professional', (professionalQuery) => {
        professionalQuery.preload('user')
      })
      .orderBy('created_at', 'desc')

    if (filters.isActive !== undefined) {
      query.where('is_active', filters.isActive)
    }

    if (filters.acceptsAppointments !== undefined) {
      query.where('accepts_appointments', filters.acceptsAppointments)
    }

    if (filters.search) {
      const search = `%${filters.search}%`

      query.where((scope) => {
        scope
          .whereRaw('local_code ILIKE ?', [search])
          .orWhereHas('professional', (professionalQuery) => {
            professionalQuery
              .whereRaw('full_name ILIKE ?', [search])
              .orWhereRaw('crm_number ILIKE ?', [search])
              .orWhereRaw('specialty ILIKE ?', [search])
          })
      })
    }

    const professionalLinks = await query.paginate(page, perPage)

    return response.ok({
      data: professionalLinks.all().map((professionalLink) => professionalLink.serialize()),
      meta: professionalLinks.getMeta(),
    })
  }

  async store({ clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const payload = await request.validateUsing(createProfessionalValidator)

    const clinicId = clinicAuthorization.clinic.id

    try {
      const result = await db.transaction(async (trx) => {
        if (payload.userId) {
          const user = await User.query({ client: trx }).where('id', payload.userId).first()

          if (!user) {
            throw new ProfessionalConflictError('Conta de usuário não encontrada')
          }

          if (!user.isActive) {
            throw new ProfessionalConflictError(
              'Não é possível vincular uma conta de usuário inativa'
            )
          }

          if (user.isGlobalAdmin) {
            throw new ProfessionalConflictError(
              'O Administrador Geral não pode possuir perfil profissional'
            )
          }

          const doctorMembership = await UserClinicRole.query({
            client: trx,
          })
            .where('user_id', user.id)
            .where('clinic_id', clinicId)
            .where('is_active', true)
            .preload('role')
            .first()

          if (
            !doctorMembership ||
            !doctorMembership.role.isActive ||
            doctorMembership.role.code !== 'doctor'
          ) {
            throw new ProfessionalConflictError(
              'A conta informada não possui vínculo médico ativo neste consultório'
            )
          }
        }

        let professional = await Professional.query({
          client: trx,
        })
          .where('crm_state', payload.crmState)
          .where('crm_number', payload.crmNumber)
          .first()

        if (professional) {
          if (!professional.isActive) {
            throw new ProfessionalConflictError(
              'Não é possível vincular um profissional globalmente inativo'
            )
          }

          if (
            normalizeComparable(professional.fullName) !== normalizeComparable(payload.fullName)
          ) {
            throw new ProfessionalConflictError(
              'O CRM informado pertence a um profissional com outro nome'
            )
          }

          if (
            normalizeComparable(professional.specialty) !== normalizeComparable(payload.specialty)
          ) {
            throw new ProfessionalConflictError(
              'O CRM informado pertence a um profissional com outra especialidade'
            )
          }

          if (payload.userId) {
            if (professional.userId && professional.userId !== payload.userId) {
              throw new ProfessionalConflictError(
                'Este profissional já está vinculado a outra conta de usuário'
              )
            }

            if (!professional.userId) {
              professional.useTransaction(trx)
              professional.userId = payload.userId
              await professional.save()
            }
          }

          const existingLink = await ClinicProfessional.query({
            client: trx,
          })
            .where('clinic_id', clinicId)
            .where('professional_id', professional.id)
            .first()

          if (existingLink) {
            throw new ProfessionalConflictError(
              'Este profissional já está vinculado ao consultório'
            )
          }
        } else {
          professional = new Professional()
          professional.useTransaction(trx)

          professional.merge({
            userId: payload.userId ?? null,
            fullName: payload.fullName,
            crmNumber: payload.crmNumber,
            crmState: payload.crmState,
            specialty: payload.specialty,
            phone: payload.phone ?? null,
            email: payload.email?.toLowerCase() ?? null,
            isActive: true,
          })

          await professional.save()
        }

        if (payload.localCode) {
          const existingLocalCode = await ClinicProfessional.query({
            client: trx,
          })
            .where('clinic_id', clinicId)
            .where('local_code', payload.localCode)
            .first()

          if (existingLocalCode) {
            throw new ProfessionalConflictError('Este código local já está em uso no consultório')
          }
        }

        const professionalLink = new ClinicProfessional()
        professionalLink.useTransaction(trx)

        professionalLink.merge({
          clinicId,
          professionalId: professional.id,
          localCode: payload.localCode ?? null,
          defaultAppointmentDurationMinutes: payload.defaultAppointmentDurationMinutes ?? 30,
          acceptsAppointments: payload.acceptsAppointments ?? true,
          isActive: true,
        })

        await professionalLink.save()

        return {
          professionalId: professional.id,
        }
      })

      const professionalLink = await loadProfessionalLink({
        clinicId,
        professionalId: result.professionalId,
      })

      return response.created({
        professionalLink: professionalLink!.serialize(),
      })
    } catch (error) {
      if (error instanceof ProfessionalConflictError) {
        return response.conflict({
          message: error.message,
        })
      }

      const constraint = getUniqueConstraint(error)
      const message = conflictMessageForConstraint(constraint)

      if (message) {
        return response.conflict({
          message,
        })
      }

      throw error
    }
  }

  async show({ clinicAuthorization, params, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const professionalLink = await loadProfessionalLink({
      clinicId: clinicAuthorization.clinic.id,
      professionalId: params.professionalId,
    })

    if (!professionalLink) {
      return response.notFound({
        message: 'Profissional não encontrado neste consultório',
      })
    }

    return response.ok({
      professionalLink: professionalLink.serialize(),
    })
  }

  async update({ clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const payload = await request.validateUsing(updateProfessionalLinkValidator)

    if (Object.keys(payload).length === 0) {
      return response.badRequest({
        message: 'Informe pelo menos um campo para atualização',
      })
    }

    const clinicId = clinicAuthorization.clinic.id

    const professionalLink = await ClinicProfessional.query()
      .where('clinic_id', clinicId)
      .where('professional_id', params.professionalId)
      .first()

    if (!professionalLink) {
      return response.notFound({
        message: 'Profissional não encontrado neste consultório',
      })
    }

    try {
      if (payload.localCode !== undefined && payload.localCode !== professionalLink.localCode) {
        if (payload.localCode) {
          const existingLocalCode = await ClinicProfessional.query()
            .where('clinic_id', clinicId)
            .where('local_code', payload.localCode)
            .whereNot('id', professionalLink.id)
            .first()

          if (existingLocalCode) {
            return response.conflict({
              message: 'Este código local já está em uso no consultório',
            })
          }
        }

        professionalLink.localCode = payload.localCode
      }

      if (payload.defaultAppointmentDurationMinutes !== undefined) {
        professionalLink.defaultAppointmentDurationMinutes =
          payload.defaultAppointmentDurationMinutes
      }

      if (payload.acceptsAppointments !== undefined) {
        professionalLink.acceptsAppointments = payload.acceptsAppointments
      }

      await professionalLink.save()

      const loadedProfessionalLink = await loadProfessionalLink({
        clinicId,
        professionalId: professionalLink.professionalId,
      })

      return response.ok({
        professionalLink: loadedProfessionalLink!.serialize(),
      })
    } catch (error) {
      const constraint = getUniqueConstraint(error)
      const message = conflictMessageForConstraint(constraint)

      if (message) {
        return response.conflict({
          message,
        })
      }

      throw error
    }
  }

  async updateStatus({ clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const professionalLink = await ClinicProfessional.query()
      .where('clinic_id', clinicAuthorization.clinic.id)
      .where('professional_id', params.professionalId)
      .preload('professional')
      .first()

    if (!professionalLink) {
      return response.notFound({
        message: 'Profissional não encontrado neste consultório',
      })
    }

    const { isActive } = await request.validateUsing(updateProfessionalLinkStatusValidator)

    if (isActive && !professionalLink.professional.isActive) {
      return response.conflict({
        message: 'Não é possível ativar o vínculo de um profissional globalmente inativo',
      })
    }

    professionalLink.isActive = isActive
    await professionalLink.save()

    const loadedProfessionalLink = await loadProfessionalLink({
      clinicId: clinicAuthorization.clinic.id,
      professionalId: professionalLink.professionalId,
    })

    return response.ok({
      professionalLink: loadedProfessionalLink!.serialize(),
    })
  }
}
