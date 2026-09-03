import type { HttpContext } from '@adonisjs/core/http'
import Clinic from '#models/clinic'
import { updateClinicStatusValidator } from '#validators/clinic'

export default class ClinicStatusController {
  async updateStatus({ params, request, response }: HttpContext) {
    const clinic = await Clinic.find(params.id)

    if (!clinic) {
      return response.notFound({
        message: 'Consultório não encontrado',
      })
    }

    const { isActive } = await request.validateUsing(updateClinicStatusValidator)

    clinic.isActive = isActive
    await clinic.save()

    return response.ok({
      clinic: clinic.serialize(),
    })
  }
}
