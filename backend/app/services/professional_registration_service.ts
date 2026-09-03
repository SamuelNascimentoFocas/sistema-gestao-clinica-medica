import type { Infer } from '@vinejs/vine/types'
import db from '@adonisjs/lucid/services/db'
import Professional from '#models/professional'
import ClinicProfessional from '#models/clinic_professional'
import User from '#models/user'
import UserClinicRole from '#models/user_clinic_role'
import DomainError from '#exceptions/domain_error'
import { loadProfessionalLink, rethrowProfessionalError } from '#services/professional_service'
import type { createProfessionalValidator } from '#validators/professional'

function normalizeComparable(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR')
}

export async function registerProfessional(
  clinicId: string,
  payload: Infer<typeof createProfessionalValidator>
) {
  try {
    const result = await db.transaction(async (trx) => {
      if (payload.userId) {
        const user = await User.query({ client: trx }).where('id', payload.userId).first()

        if (!user) {
          throw new DomainError('conflict', 'Conta de usuário não encontrada')
        }

        if (!user.isActive) {
          throw new DomainError('conflict', 'Não é possível vincular uma conta de usuário inativa')
        }

        if (user.isGlobalAdmin) {
          throw new DomainError(
            'conflict',
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
          throw new DomainError(
            'conflict',
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
          throw new DomainError(
            'conflict',
            'Não é possível vincular um profissional globalmente inativo'
          )
        }

        if (normalizeComparable(professional.fullName) !== normalizeComparable(payload.fullName)) {
          throw new DomainError(
            'conflict',
            'O CRM informado pertence a um profissional com outro nome'
          )
        }

        if (
          normalizeComparable(professional.specialty) !== normalizeComparable(payload.specialty)
        ) {
          throw new DomainError(
            'conflict',
            'O CRM informado pertence a um profissional com outra especialidade'
          )
        }

        if (payload.userId) {
          if (professional.userId && professional.userId !== payload.userId) {
            throw new DomainError(
              'conflict',
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
          throw new DomainError('conflict', 'Este profissional já está vinculado ao consultório')
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
          throw new DomainError('conflict', 'Este código local já está em uso no consultório')
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

    return professionalLink!
  } catch (error) {
    rethrowProfessionalError(error)
  }
}
