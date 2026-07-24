import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Appointment from '#models/appointment'
import PatientClinic from '#models/patient_clinic'
import ClinicProfessional from '#models/clinic_professional'
import ProfessionalScheduleBlock from '#models/professional_schedule_block'
import ProfessionalWeeklyAvailability from '#models/professional_weekly_availability'
import {
  createAppointmentValidator,
  listAppointmentsValidator,
  updateAppointmentValidator,
} from '#validators/appointment'

type AppointmentRequestStatus = 403 | 404 | 409 | 422

class AppointmentRequestError extends Error {
  constructor(
    public status: AppointmentRequestStatus,
    message: string
  ) {
    super(message)
  }
}

type PostgreSqlError = {
  code?: string
  constraint?: string
}

const FINAL_STATUSES = ['completed', 'cancelled', 'no_show']

function getPostgreSqlError(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return null
  }

  return error as PostgreSqlError
}

function hasMutableAppointmentField(payload: {
  patientClinicId?: string
  clinicProfessionalId?: string
  startsAt?: DateTime
  durationMinutes?: number
  appointmentTypeCode?: string | null
  administrativeNote?: string | null
}) {
  return (
    payload.patientClinicId !== undefined ||
    payload.clinicProfessionalId !== undefined ||
    payload.startsAt !== undefined ||
    payload.durationMinutes !== undefined ||
    payload.appointmentTypeCode !== undefined ||
    payload.administrativeNote !== undefined
  )
}

async function loadAppointment({
  clinicId,
  appointmentId,
}: {
  clinicId: string
  appointmentId: string
}) {
  return Appointment.query()
    .where('clinic_id', clinicId)
    .where('id', appointmentId)
    .preload('clinic')
    .preload('patientClinic', (patientLinkQuery) => {
      patientLinkQuery.preload('patient')
    })
    .preload('clinicProfessional', (professionalLinkQuery) => {
      professionalLinkQuery.preload('professional')
    })
    .preload('createdByUser')
    .preload('confirmedByUser')
    .preload('completedByUser')
    .preload('cancelledByUser')
    .preload('noShowByUser')
    .preload('rescheduledFrom')
    .preload('rescheduledTo')
    .first()
}

async function loadPatientLink({
  clinicId,
  patientClinicId,
}: {
  clinicId: string
  patientClinicId: string
}) {
  const patientLink = await PatientClinic.query()
    .where('clinic_id', clinicId)
    .where('id', patientClinicId)
    .preload('patient')
    .first()

  if (!patientLink) {
    throw new AppointmentRequestError(404, 'Paciente não encontrado neste consultório')
  }

  if (!patientLink.isActive || !patientLink.patient.isActive) {
    throw new AppointmentRequestError(
      409,
      'Não é possível agendar para um paciente com vínculo inativo'
    )
  }

  return patientLink
}

async function findProfessionalLink({
  clinicId,
  clinicProfessionalId,
}: {
  clinicId: string
  clinicProfessionalId: string
}) {
  const professionalLink = await ClinicProfessional.query()
    .where('clinic_id', clinicId)
    .where('id', clinicProfessionalId)
    .preload('professional')
    .first()

  if (!professionalLink) {
    throw new AppointmentRequestError(404, 'Profissional não encontrado neste consultório')
  }

  return professionalLink
}

async function loadSchedulableProfessionalLink({
  clinicId,
  clinicProfessionalId,
}: {
  clinicId: string
  clinicProfessionalId: string
}) {
  const professionalLink = await findProfessionalLink({
    clinicId,
    clinicProfessionalId,
  })

  if (!professionalLink.isActive || !professionalLink.professional.isActive) {
    throw new AppointmentRequestError(
      409,
      'Não é possível agendar para um profissional com vínculo inativo'
    )
  }

  if (!professionalLink.acceptsAppointments) {
    throw new AppointmentRequestError(409, 'Este profissional não está aceitando agendamentos')
  }

  return professionalLink
}

function assertProfessionalScope({
  managementScope,
  userId,
  professionalLink,
}: {
  managementScope: 'all' | 'own'
  userId: string
  professionalLink: ClinicProfessional
}) {
  if (managementScope === 'all') {
    return
  }

  if (professionalLink.professional.userId !== userId) {
    throw new AppointmentRequestError(403, 'Você somente pode administrar os próprios agendamentos')
  }
}

async function validateAppointmentSlot({
  clinicId,
  clinicTimezone,
  clinicProfessionalId,
  startsAt,
  endsAt,
  excludeAppointmentId,
}: {
  clinicId: string
  clinicTimezone: string
  clinicProfessionalId: string
  startsAt: DateTime
  endsAt: DateTime
  excludeAppointmentId?: string
}) {
  if (startsAt.toMillis() >= endsAt.toMillis()) {
    throw new AppointmentRequestError(422, 'O início do agendamento deve ser anterior ao fim')
  }

  if (startsAt.toMillis() <= DateTime.utc().toMillis()) {
    throw new AppointmentRequestError(422, 'O agendamento deve começar em uma data futura')
  }

  const durationMinutes = endsAt.diff(startsAt, 'minutes').minutes

  if (durationMinutes < 5 || durationMinutes > 480) {
    throw new AppointmentRequestError(
      422,
      'A duração do agendamento deve estar entre 5 e 480 minutos'
    )
  }

  const localStartsAt = startsAt.setZone(clinicTimezone)
  const localEndsAt = endsAt.setZone(clinicTimezone)

  if (!localStartsAt.isValid || !localEndsAt.isValid) {
    throw new AppointmentRequestError(422, 'Data ou horário inválido')
  }

  if (localStartsAt.toISODate() !== localEndsAt.toISODate()) {
    throw new AppointmentRequestError(
      422,
      'O agendamento deve começar e terminar no mesmo dia local'
    )
  }

  const localStartTime = localStartsAt.toFormat('HH:mm:ss')
  const localEndTime = localEndsAt.toFormat('HH:mm:ss')

  const weeklyAvailability = await ProfessionalWeeklyAvailability.query()
    .where('clinic_professional_id', clinicProfessionalId)
    .where('weekday', localStartsAt.weekday)
    .where('is_active', true)
    .where('start_time', '<=', localStartTime)
    .where('end_time', '>=', localEndTime)
    .first()

  if (!weeklyAvailability) {
    throw new AppointmentRequestError(
      409,
      'O horário informado está fora da disponibilidade semanal do profissional'
    )
  }

  const scheduleBlock = await ProfessionalScheduleBlock.query()
    .where('clinic_professional_id', clinicProfessionalId)
    .where('is_active', true)
    .where('starts_at', '<', endsAt.toSQL()!)
    .where('ends_at', '>', startsAt.toSQL()!)
    .first()

  if (scheduleBlock) {
    throw new AppointmentRequestError(409, 'O horário informado conflita com um bloqueio da agenda')
  }

  const overlapQuery = Appointment.query()
    .where('clinic_id', clinicId)
    .where('clinic_professional_id', clinicProfessionalId)
    .whereIn('status', ['scheduled', 'confirmed'])
    .where('starts_at', '<', endsAt.toSQL()!)
    .where('ends_at', '>', startsAt.toSQL()!)

  if (excludeAppointmentId) {
    overlapQuery.whereNot('id', excludeAppointmentId)
  }

  const overlappingAppointment = await overlapQuery.first()

  if (overlappingAppointment) {
    throw new AppointmentRequestError(
      409,
      'O horário informado conflita com outro agendamento ativo'
    )
  }
}

function throwResponseForAppointmentError({
  error,
  response,
}: {
  error: AppointmentRequestError
  response: HttpContext['response']
}) {
  switch (error.status) {
    case 403:
      return response.forbidden({
        message: error.message,
      })

    case 404:
      return response.notFound({
        message: error.message,
      })

    case 409:
      return response.conflict({
        message: error.message,
      })

    case 422:
      return response.unprocessableEntity({
        message: error.message,
      })
  }
}

export default class AppointmentsController {
  async index({ clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const filters = await listAppointmentsValidator.validate(request.qs())

    if (filters.from.toMillis() >= filters.to.toMillis()) {
      return response.unprocessableEntity({
        message: 'A data inicial do filtro deve ser anterior à data final',
      })
    }

    const intervalInDays = filters.to.diff(filters.from, 'days').days

    if (intervalInDays > 31) {
      return response.unprocessableEntity({
        message: 'O intervalo da agenda não pode ultrapassar 31 dias',
      })
    }

    const page = filters.page ?? 1
    const perPage = filters.perPage ?? 20

    const query = Appointment.query()
      .where('clinic_id', clinicAuthorization.clinic.id)
      .preload('patientClinic', (patientLinkQuery) => {
        patientLinkQuery.preload('patient')
      })
      .preload('clinicProfessional', (professionalLinkQuery) => {
        professionalLinkQuery.preload('professional')
      })
      .preload('createdByUser')
      .orderBy('starts_at', 'asc')

    if (filters.status) {
      query.where('status', filters.status)
    }

    if (filters.patientClinicId) {
      query.where('patient_clinic_id', filters.patientClinicId)
    }

    if (filters.clinicProfessionalId) {
      query.where('clinic_professional_id', filters.clinicProfessionalId)
    }

    query.where('starts_at', '<', filters.to.toSQL()!).where('ends_at', '>', filters.from.toSQL()!)

    const appointments = await query.paginate(page, perPage)

    return response.ok({
      data: appointments.all().map((appointment) => appointment.serialize()),
      meta: appointments.getMeta(),
    })
  }

  async show({ clinicAuthorization, params, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const appointment = await loadAppointment({
      clinicId: clinicAuthorization.clinic.id,
      appointmentId: params.appointmentId,
    })

    if (!appointment) {
      return response.notFound({
        message: 'Agendamento não encontrado neste consultório',
      })
    }

    return response.ok({
      appointment: appointment.serialize(),
    })
  }

  async store({
    auth,
    clinicAuthorization,
    appointmentManagementScope,
    request,
    response,
  }: HttpContext) {
    if (!clinicAuthorization || !appointmentManagementScope) {
      return response.internalServerError({
        message: 'Contexto de autorização de agendamento não inicializado',
      })
    }

    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createAppointmentValidator)
    const clinicId = clinicAuthorization.clinic.id

    try {
      await loadPatientLink({
        clinicId,
        patientClinicId: payload.patientClinicId,
      })

      const professionalLink = await loadSchedulableProfessionalLink({
        clinicId,
        clinicProfessionalId: payload.clinicProfessionalId,
      })

      assertProfessionalScope({
        managementScope: appointmentManagementScope,
        userId: user.id,
        professionalLink,
      })

      const durationMinutes =
        payload.durationMinutes ?? professionalLink.defaultAppointmentDurationMinutes

      const endsAt = payload.startsAt.plus({
        minutes: durationMinutes,
      })

      await validateAppointmentSlot({
        clinicId,
        clinicTimezone: clinicAuthorization.clinic.timezone,
        clinicProfessionalId: professionalLink.id,
        startsAt: payload.startsAt,
        endsAt,
      })

      const appointmentId = await db.transaction(async (trx) => {
        const appointment = new Appointment()
        appointment.useTransaction(trx)

        appointment.merge({
          clinicId,
          patientClinicId: payload.patientClinicId,
          clinicProfessionalId: professionalLink.id,
          startsAt: payload.startsAt,
          endsAt,
          status: 'scheduled',
          version: 1,
          appointmentTypeCode: payload.appointmentTypeCode ?? null,
          administrativeNote: payload.administrativeNote ?? null,
          createdByUserId: user.id,
          confirmedAt: null,
          confirmedByUserId: null,
          completedAt: null,
          completedByUserId: null,
          cancelledAt: null,
          cancelledByUserId: null,
          cancellationReasonCode: null,
          cancellationNote: null,
          noShowAt: null,
          noShowByUserId: null,
          rescheduledFromAppointmentId: null,
        })

        await appointment.save()

        return appointment.id
      })

      const appointment = await loadAppointment({
        clinicId,
        appointmentId,
      })

      return response.created({
        appointment: appointment!.serialize(),
      })
    } catch (error) {
      if (error instanceof AppointmentRequestError) {
        return throwResponseForAppointmentError({
          error,
          response,
        })
      }

      const databaseError = getPostgreSqlError(error)

      if (databaseError?.code === '23P01') {
        return response.conflict({
          message: 'O horário informado conflita com outro agendamento ativo',
        })
      }

      throw error
    }
  }

  async update({
    auth,
    clinicAuthorization,
    appointmentManagementScope,
    params,
    request,
    response,
  }: HttpContext) {
    if (!clinicAuthorization || !appointmentManagementScope) {
      return response.internalServerError({
        message: 'Contexto de autorização de agendamento não inicializado',
      })
    }

    const payload = await request.validateUsing(updateAppointmentValidator)

    if (!hasMutableAppointmentField(payload)) {
      return response.badRequest({
        message: 'Informe pelo menos um campo para atualização',
      })
    }

    const user = auth.getUserOrFail()
    const clinicId = clinicAuthorization.clinic.id
    const appointmentId = params.appointmentId

    try {
      await db.transaction(async (trx) => {
        const appointment = await Appointment.query({
          client: trx,
        })
          .where('clinic_id', clinicId)
          .where('id', appointmentId)
          .forUpdate()
          .first()

        if (!appointment) {
          throw new AppointmentRequestError(404, 'Agendamento não encontrado neste consultório')
        }

        if (FINAL_STATUSES.includes(appointment.status)) {
          throw new AppointmentRequestError(
            409,
            'Não é possível editar um agendamento que já possui status final'
          )
        }

        if (appointment.version !== payload.expectedVersion) {
          throw new AppointmentRequestError(
            409,
            'O agendamento foi alterado por outro usuário; atualize os dados e tente novamente'
          )
        }

        const currentProfessionalLink = await findProfessionalLink({
          clinicId,
          clinicProfessionalId: appointment.clinicProfessionalId,
        })

        assertProfessionalScope({
          managementScope: appointmentManagementScope,
          userId: user.id,
          professionalLink: currentProfessionalLink,
        })

        const patientClinicId = payload.patientClinicId ?? appointment.patientClinicId

        const clinicProfessionalId =
          payload.clinicProfessionalId ?? appointment.clinicProfessionalId

        if (payload.patientClinicId !== undefined) {
          await loadPatientLink({
            clinicId,
            patientClinicId,
          })
        }

        const targetProfessionalLink =
          clinicProfessionalId === currentProfessionalLink.id
            ? currentProfessionalLink
            : await findProfessionalLink({
                clinicId,
                clinicProfessionalId,
              })

        assertProfessionalScope({
          managementScope: appointmentManagementScope,
          userId: user.id,
          professionalLink: targetProfessionalLink,
        })

        const startsAt = payload.startsAt ?? appointment.startsAt

        const currentDurationMinutes = Math.round(
          appointment.endsAt.diff(appointment.startsAt, 'minutes').minutes
        )

        const durationMinutes = payload.durationMinutes ?? currentDurationMinutes

        const endsAt = startsAt.plus({
          minutes: durationMinutes,
        })

        const scheduleChanged =
          payload.clinicProfessionalId !== undefined ||
          payload.startsAt !== undefined ||
          payload.durationMinutes !== undefined

        if (scheduleChanged) {
          await loadSchedulableProfessionalLink({
            clinicId,
            clinicProfessionalId,
          })

          await validateAppointmentSlot({
            clinicId,
            clinicTimezone: clinicAuthorization.clinic.timezone,
            clinicProfessionalId,
            startsAt,
            endsAt,
            excludeAppointmentId: appointment.id,
          })
        }

        appointment.useTransaction(trx)

        appointment.merge({
          patientClinicId,
          clinicProfessionalId,
          startsAt,
          endsAt,
          appointmentTypeCode:
            payload.appointmentTypeCode !== undefined
              ? payload.appointmentTypeCode
              : appointment.appointmentTypeCode,
          administrativeNote:
            payload.administrativeNote !== undefined
              ? payload.administrativeNote
              : appointment.administrativeNote,
          version: appointment.version + 1,
        })

        await appointment.save()
      })

      const appointment = await loadAppointment({
        clinicId,
        appointmentId,
      })

      return response.ok({
        appointment: appointment!.serialize(),
      })
    } catch (error) {
      if (error instanceof AppointmentRequestError) {
        return throwResponseForAppointmentError({
          error,
          response,
        })
      }

      const databaseError = getPostgreSqlError(error)

      if (databaseError?.code === '23P01') {
        return response.conflict({
          message: 'O horário informado conflita com outro agendamento ativo',
        })
      }

      throw error
    }
  }
}
