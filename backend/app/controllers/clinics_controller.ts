import type { HttpContext } from '@adonisjs/core/http'
import Clinic from '#models/clinic'
import {
  createClinicValidator,
  listClinicsValidator,
  updateClinicStatusValidator,
  updateClinicValidator,
} from '#validators/clinic'

async function cnpjAlreadyExists(cnpj: string, exceptClinicId?: string) {
  const query = Clinic.query().where('cnpj', cnpj)

  if (exceptClinicId) {
    query.whereNot('id', exceptClinicId)
  }

  return Boolean(await query.first())
}

export default class ClinicsController {
  async index({ request, response }: HttpContext) {
    const filters = await listClinicsValidator.validate(request.qs())

    const page = filters.page ?? 1
    const perPage = filters.perPage ?? 20

    const query = Clinic.query().orderBy('name', 'asc')

    if (filters.search) {
      query.whereRaw('name ILIKE ?', [`%${filters.search}%`])
    }

    if (filters.isActive !== undefined) {
      query.where('is_active', filters.isActive)
    }

    const clinics = await query.paginate(page, perPage)

    return response.ok({
      data: clinics.all().map((clinic) => clinic.serialize()),
      meta: clinics.getMeta(),
    })
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createClinicValidator)

    if (payload.cnpj && (await cnpjAlreadyExists(payload.cnpj))) {
      return response.conflict({
        message: 'Já existe um consultório cadastrado com este CNPJ',
      })
    }

    const clinic = await Clinic.create({
      name: payload.name,
      cnpj: payload.cnpj ?? null,
      phone: payload.phone ?? null,
      addressStreet: payload.addressStreet ?? null,
      addressNumber: payload.addressNumber ?? null,
      addressComplement: payload.addressComplement ?? null,
      addressNeighborhood: payload.addressNeighborhood ?? null,
      addressCity: payload.addressCity ?? null,
      addressState: payload.addressState?.toUpperCase() ?? null,
      addressPostalCode: payload.addressPostalCode ?? null,
      isActive: true,
    })

    return response.created({
      clinic: clinic.serialize(),
    })
  }

  async show({ params, response }: HttpContext) {
    const clinic = await Clinic.find(params.id)

    if (!clinic) {
      return response.notFound({
        message: 'Consultório não encontrado',
      })
    }

    return response.ok({
      clinic: clinic.serialize(),
    })
  }

  async update({ params, request, response }: HttpContext) {
    const clinic = await Clinic.find(params.id)

    if (!clinic) {
      return response.notFound({
        message: 'Consultório não encontrado',
      })
    }

    const payload = await request.validateUsing(updateClinicValidator)

    if (Object.keys(payload).length === 0) {
      return response.badRequest({
        message: 'Informe pelo menos um campo para atualização',
      })
    }

    if (
      payload.cnpj &&
      payload.cnpj !== clinic.cnpj &&
      (await cnpjAlreadyExists(payload.cnpj, clinic.id))
    ) {
      return response.conflict({
        message: 'Já existe um consultório cadastrado com este CNPJ',
      })
    }

    if (payload.name !== undefined) {
      clinic.name = payload.name
    }

    if (payload.cnpj !== undefined) {
      clinic.cnpj = payload.cnpj
    }

    if (payload.phone !== undefined) {
      clinic.phone = payload.phone
    }

    if (payload.addressStreet !== undefined) {
      clinic.addressStreet = payload.addressStreet
    }

    if (payload.addressNumber !== undefined) {
      clinic.addressNumber = payload.addressNumber
    }

    if (payload.addressComplement !== undefined) {
      clinic.addressComplement = payload.addressComplement
    }

    if (payload.addressNeighborhood !== undefined) {
      clinic.addressNeighborhood = payload.addressNeighborhood
    }

    if (payload.addressCity !== undefined) {
      clinic.addressCity = payload.addressCity
    }

    if (payload.addressState !== undefined) {
      clinic.addressState = payload.addressState?.toUpperCase() ?? null
    }

    if (payload.addressPostalCode !== undefined) {
      clinic.addressPostalCode = payload.addressPostalCode
    }

    await clinic.save()

    return response.ok({
      clinic: clinic.serialize(),
    })
  }

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
