import type { Infer } from '@vinejs/vine/types'
import ClinicProfessional from '#models/clinic_professional'
import DomainError from '#exceptions/domain_error'
import { getUniqueConstraint } from '#services/postgres_error'
import type {
  listProfessionalsValidator,
  updateProfessionalLinkValidator,
} from '#validators/professional'

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

export function rethrowProfessionalError(error: unknown): never {
  const message = conflictMessageForConstraint(getUniqueConstraint(error))
  if (message) throw new DomainError('conflict', message)
  throw error
}

export async function loadProfessionalLink({
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

export async function listProfessionals(
  clinicId: string,
  filters: Infer<typeof listProfessionalsValidator>
) {
  const page = filters.page ?? 1
  const perPage = filters.perPage ?? 20

  const query = ClinicProfessional.query()
    .where('clinic_id', clinicId)
    .preload('professional', (professionalQuery) => {
      professionalQuery.preload('user')
    })
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')

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

  return professionalLinks
}

export async function findProfessionalLinkForStatus(clinicId: string, professionalId: string) {
  const professionalLink = await ClinicProfessional.query()
    .where('clinic_id', clinicId)
    .where('professional_id', professionalId)
    .preload('professional')
    .first()

  return professionalLink
}
export async function findProfessionalLink(clinicId: string, professionalId: string) {
  return ClinicProfessional.query()
    .where('clinic_id', clinicId)
    .where('professional_id', professionalId)
    .first()
}

export async function updateProfessional(
  clinicId: string,
  professionalLink: ClinicProfessional,
  payload: Infer<typeof updateProfessionalLinkValidator>
) {
  try {
    if (payload.localCode !== undefined && payload.localCode !== professionalLink.localCode) {
      if (payload.localCode) {
        const existingLocalCode = await ClinicProfessional.query()
          .where('clinic_id', clinicId)
          .where('local_code', payload.localCode)
          .whereNot('id', professionalLink.id)
          .first()

        if (existingLocalCode) {
          throw new DomainError('conflict', 'Este código local já está em uso no consultório')
        }
      }

      professionalLink.localCode = payload.localCode
    }

    if (payload.defaultAppointmentDurationMinutes !== undefined) {
      professionalLink.defaultAppointmentDurationMinutes = payload.defaultAppointmentDurationMinutes
    }

    if (payload.acceptsAppointments !== undefined) {
      professionalLink.acceptsAppointments = payload.acceptsAppointments
    }

    await professionalLink.save()

    const loadedProfessionalLink = await loadProfessionalLink({
      clinicId,
      professionalId: professionalLink.professionalId,
    })

    return loadedProfessionalLink!
  } catch (error) {
    rethrowProfessionalError(error)
  }
}

export async function setProfessionalLinkStatus(
  clinicId: string,
  professionalLink: ClinicProfessional,
  isActive: boolean
) {
  if (isActive && !professionalLink.professional.isActive) {
    throw new DomainError(
      'conflict',
      'Não é possível ativar o vínculo de um profissional globalmente inativo'
    )
  }

  professionalLink.isActive = isActive
  await professionalLink.save()

  const loadedProfessionalLink = await loadProfessionalLink({
    clinicId,
    professionalId: professionalLink.professionalId,
  })

  return loadedProfessionalLink!
}
