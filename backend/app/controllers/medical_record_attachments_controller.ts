import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import PatientClinic from '#models/patient_clinic'
import MedicalRecordEntry from '#models/medical_record_entry'
import MedicalRecordAttachment from '#models/medical_record_attachment'
import MedicalRecordAccessLog from '#models/medical_record_access_log'
import {
  readMedicalRecordAttachmentsValidator,
  uploadMedicalRecordAttachmentsValidator,
} from '#validators/medical_record_attachment'

const ATTACHMENT_STORAGE_DISK = 'private_fs' as const

const ALLOWED_ATTACHMENT_CONTENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png'])

type AttachmentRequestStatus = 404 | 409 | 422

type AttachmentAccessPurpose = 'patient_care' | 'care_coordination' | 'legal_obligation' | 'other'

type AttachmentAccessAction = 'list_attachments' | 'download_attachment'

class AttachmentRequestError extends Error {
  constructor(
    public status: AttachmentRequestStatus,
    message: string
  ) {
    super(message)
  }
}

async function loadPatientContext({
  clinicId,
  patientId,
  client,
  lock = false,
}: {
  clinicId: string
  patientId: string
  client?: TransactionClientContract
  lock?: boolean
}) {
  const query = client ? PatientClinic.query({ client }) : PatientClinic.query()

  query
    .where('clinic_id', clinicId)
    .where('patient_id', patientId)
    .preload('patient', (patientQuery) => {
      patientQuery.preload('medicalRecord')
    })

  if (lock) {
    query.forUpdate()
  }

  const patientLink = await query.first()

  if (!patientLink) {
    throw new AttachmentRequestError(404, 'Paciente não encontrado neste consultório')
  }

  if (!patientLink.isActive || !patientLink.patient.isActive) {
    throw new AttachmentRequestError(
      409,
      'O paciente ou seu vínculo com o consultório está inativo'
    )
  }

  const medicalRecord = patientLink.patient.medicalRecord

  if (!medicalRecord) {
    throw new AttachmentRequestError(409, 'O paciente não possui um prontuário associado')
  }

  return {
    patientLink,
    patient: patientLink.patient,
    medicalRecord,
  }
}

async function loadWritableEntry({
  clinicId,
  patientId,
  medicalRecordId,
  entryId,
  client,
  lock = false,
}: {
  clinicId: string
  patientId: string
  medicalRecordId: string
  entryId: string
  client?: TransactionClientContract
  lock?: boolean
}) {
  const query = client ? MedicalRecordEntry.query({ client }) : MedicalRecordEntry.query()

  query
    .where('id', entryId)
    .where('clinic_id', clinicId)
    .where('patient_id', patientId)
    .where('medical_record_id', medicalRecordId)

  if (lock) {
    query.forUpdate()
  }

  const entry = await query.first()

  if (!entry) {
    throw new AttachmentRequestError(404, 'Entrada do prontuário não encontrada neste consultório')
  }

  return entry
}

async function loadReadableEntry({
  patientId,
  medicalRecordId,
  entryId,
}: {
  patientId: string
  medicalRecordId: string
  entryId: string
}) {
  const entry = await MedicalRecordEntry.query()
    .where('id', entryId)
    .where('patient_id', patientId)
    .where('medical_record_id', medicalRecordId)
    .first()

  if (!entry) {
    throw new AttachmentRequestError(404, 'Entrada do prontuário não encontrada')
  }

  return entry
}

async function loadAttachment({
  patientId,
  medicalRecordId,
  entryId,
  attachmentId,
}: {
  patientId: string
  medicalRecordId: string
  entryId: string
  attachmentId: string
}) {
  const attachment = await MedicalRecordAttachment.query()
    .where('id', attachmentId)
    .where('patient_id', patientId)
    .where('medical_record_id', medicalRecordId)
    .where('medical_record_entry_id', entryId)
    .first()

  if (!attachment) {
    throw new AttachmentRequestError(404, 'Anexo do prontuário não encontrado')
  }

  return attachment
}

function normalizeOriginalName(clientName: string) {
  const normalizedPath = clientName.replaceAll('\\', '/')
  const originalName = normalizedPath.split('/').pop()?.trim() ?? ''

  if (!originalName) {
    throw new AttachmentRequestError(422, 'O nome original do arquivo é obrigatório')
  }

  if (originalName.length > 255) {
    throw new AttachmentRequestError(
      422,
      'O nome original do arquivo não pode ultrapassar 255 caracteres'
    )
  }

  return originalName
}

function resolveContentType(file: MultipartFile) {
  const type = file.type?.toLowerCase()
  const subtype = file.subtype?.toLowerCase()

  const contentType = type?.includes('/') ? type : type && subtype ? `${type}/${subtype}` : null

  if (!contentType || !ALLOWED_ATTACHMENT_CONTENT_TYPES.has(contentType)) {
    throw new AttachmentRequestError(422, 'O tipo real do arquivo não é permitido')
  }

  return contentType
}

async function calculateSha256(tmpPath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(tmpPath)

    stream.on('error', reject)

    stream.on('data', (chunk) => {
      hash.update(chunk)
    })

    stream.on('end', () => {
      resolve(hash.digest('hex'))
    })
  })
}

function validateAccessPurpose({
  purposeCode,
  purposeNote,
}: {
  purposeCode: AttachmentAccessPurpose
  purposeNote?: string | null
}) {
  if (purposeCode === 'other' && !purposeNote) {
    throw new AttachmentRequestError(
      422,
      'A finalidade deve ser detalhada quando o código informado for other'
    )
  }
}

function serializePublicAttachment(attachment: MedicalRecordAttachment) {
  return {
    id: attachment.id,
    medicalRecordEntryId: attachment.medicalRecordEntryId,
    medicalRecordId: attachment.medicalRecordId,
    patientId: attachment.patientId,
    clinicId: attachment.clinicId,
    uploadedByUserId: attachment.uploadedByUserId,
    originalName: attachment.originalName,
    contentType: attachment.contentType,
    sizeInBytes: attachment.sizeInBytes,
    status: attachment.status,
    statusReason: attachment.statusReason,
    createdAt: attachment.createdAt,
    updatedAt: attachment.updatedAt,
  }
}

async function registerAttachmentAccess({
  medicalRecordId,
  patientId,
  clinicId,
  patientClinicId,
  userId,
  accessAction,
  purposeCode,
  purposeNote,
  attachmentId = null,
}: {
  medicalRecordId: string
  patientId: string
  clinicId: string
  patientClinicId: string
  userId: string
  accessAction: AttachmentAccessAction
  purposeCode: AttachmentAccessPurpose
  purposeNote?: string | null
  attachmentId?: string | null
}) {
  await MedicalRecordAccessLog.create({
    medicalRecordId,
    patientId,
    clinicId,
    patientClinicId,
    userId,
    accessAction,
    purposeCode,
    purposeNote: purposeNote ?? null,
    medicalRecordAttachmentId: attachmentId,
  })
}

function buildContentDisposition(originalName: string) {
  const fallbackName =
    Array.from(originalName, (character) => {
      const characterCode = character.charCodeAt(0)

      if (characterCode < 32 || characterCode > 126 || character === '"' || character === '\\') {
        return '_'
      }

      return character
    })
      .join('')
      .trim() || 'attachment'

  const encodedName = encodeURIComponent(originalName).replace(/[!'()*]/g, (character) => {
    return `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  })

  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`
}

function respondForAttachmentError({
  error,
  response,
}: {
  error: AttachmentRequestError
  response: HttpContext['response']
}) {
  switch (error.status) {
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

export default class MedicalRecordAttachmentsController {
  async index({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const user = auth.getUserOrFail()

    const filters = await readMedicalRecordAttachmentsValidator.validate(request.qs())

    const clinicId = clinicAuthorization.clinic.id

    try {
      validateAccessPurpose(filters)

      const { patientLink, patient, medicalRecord } = await loadPatientContext({
        clinicId,
        patientId: params.patientId,
      })

      const entry = await loadReadableEntry({
        patientId: patient.id,
        medicalRecordId: medicalRecord.id,
        entryId: params.entryId,
      })

      const page = filters.page ?? 1
      const perPage = filters.perPage ?? 20

      const attachments = await MedicalRecordAttachment.query()
        .where('patient_id', patient.id)
        .where('medical_record_id', medicalRecord.id)
        .where('medical_record_entry_id', entry.id)
        .where('status', 'available')
        .orderBy('created_at', 'desc')
        .paginate(page, perPage)

      await registerAttachmentAccess({
        medicalRecordId: medicalRecord.id,
        patientId: patient.id,
        clinicId,
        patientClinicId: patientLink.id,
        userId: user.id,
        accessAction: 'list_attachments',
        purposeCode: filters.purposeCode,
        purposeNote: filters.purposeNote,
      })

      response.header('Cache-Control', 'private, no-store')

      return response.ok({
        attachments: attachments.all().map((attachment) => serializePublicAttachment(attachment)),

        meta: attachments.getMeta(),
      })
    } catch (error) {
      if (error instanceof AttachmentRequestError) {
        return respondForAttachmentError({
          error,
          response,
        })
      }

      throw error
    }
  }

  async store({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const user = auth.getUserOrFail()

    const payload = await request.validateUsing(uploadMedicalRecordAttachmentsValidator)

    const clinicId = clinicAuthorization.clinic.id
    const movedStorageKeys: string[] = []

    try {
      const { patient, medicalRecord } = await loadPatientContext({
        clinicId,
        patientId: params.patientId,
      })

      const entry = await loadWritableEntry({
        clinicId,
        patientId: patient.id,
        medicalRecordId: medicalRecord.id,
        entryId: params.entryId,
      })

      const preparedFiles = await Promise.all(
        payload.files.map(async (file) => {
          if (!file.tmpPath) {
            throw new AttachmentRequestError(422, 'O arquivo não foi processado corretamente')
          }

          const extension = file.extname?.toLowerCase()

          if (!extension) {
            throw new AttachmentRequestError(
              422,
              'Não foi possível identificar a extensão do arquivo'
            )
          }

          const originalName = normalizeOriginalName(file.clientName)
          const contentType = resolveContentType(file)
          const sha256 = await calculateSha256(file.tmpPath)

          const storageKey =
            `medical-records/${medicalRecord.id}/entries/${entry.id}/` +
            `${randomUUID()}.${extension}`

          return {
            file,
            originalName,
            contentType,
            sha256,
            storageKey,
          }
        })
      )

      for (const preparedFile of preparedFiles) {
        await preparedFile.file.moveToDisk(preparedFile.storageKey, ATTACHMENT_STORAGE_DISK)

        movedStorageKeys.push(preparedFile.storageKey)
      }

      const attachments = await db.transaction(async (trx) => {
        const currentContext = await loadPatientContext({
          clinicId,
          patientId: params.patientId,
          client: trx,
          lock: true,
        })

        const currentEntry = await loadWritableEntry({
          clinicId,
          patientId: currentContext.patient.id,
          medicalRecordId: currentContext.medicalRecord.id,
          entryId: params.entryId,
          client: trx,
          lock: true,
        })

        const createdAttachments: MedicalRecordAttachment[] = []

        for (const preparedFile of preparedFiles) {
          const attachment = new MedicalRecordAttachment()
          attachment.useTransaction(trx)

          attachment.merge({
            medicalRecordEntryId: currentEntry.id,
            medicalRecordId: currentContext.medicalRecord.id,
            patientId: currentContext.patient.id,
            clinicId,
            uploadedByUserId: user.id,
            originalName: preparedFile.originalName,
            storageDisk: ATTACHMENT_STORAGE_DISK,
            storageKey: preparedFile.storageKey,
            contentType: preparedFile.contentType,
            sizeInBytes: preparedFile.file.size,
            sha256: preparedFile.sha256,
            status: 'available',
            statusReason: null,
          })

          await attachment.save()
          createdAttachments.push(attachment)
        }

        return createdAttachments
      })

      response.header('Cache-Control', 'private, no-store')

      return response.created({
        attachments: attachments.map((attachment) => serializePublicAttachment(attachment)),
      })
    } catch (error) {
      if (movedStorageKeys.length > 0) {
        const disk = drive.use(ATTACHMENT_STORAGE_DISK)

        await Promise.allSettled(movedStorageKeys.map((storageKey) => disk.delete(storageKey)))
      }

      if (error instanceof AttachmentRequestError) {
        return respondForAttachmentError({
          error,
          response,
        })
      }

      throw error
    }
  }

  async download({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const user = auth.getUserOrFail()

    const filters = await readMedicalRecordAttachmentsValidator.validate(request.qs())

    const clinicId = clinicAuthorization.clinic.id

    try {
      validateAccessPurpose(filters)

      const { patientLink, patient, medicalRecord } = await loadPatientContext({
        clinicId,
        patientId: params.patientId,
      })

      const entry = await loadReadableEntry({
        patientId: patient.id,
        medicalRecordId: medicalRecord.id,
        entryId: params.entryId,
      })

      const attachment = await loadAttachment({
        patientId: patient.id,
        medicalRecordId: medicalRecord.id,
        entryId: entry.id,
        attachmentId: params.attachmentId,
      })

      if (attachment.status !== 'available') {
        throw new AttachmentRequestError(409, 'O anexo ainda não está disponível para download')
      }

      if (attachment.storageDisk !== ATTACHMENT_STORAGE_DISK) {
        return response.internalServerError({
          message: 'O anexo está associado a um armazenamento não configurado',
        })
      }

      const disk = drive.use(ATTACHMENT_STORAGE_DISK)

      const fileExists = await disk.exists(attachment.storageKey)

      if (!fileExists) {
        throw new AttachmentRequestError(409, 'O arquivo físico do anexo está indisponível')
      }

      const fileContents = await disk.getBytes(attachment.storageKey)

      await registerAttachmentAccess({
        medicalRecordId: medicalRecord.id,
        patientId: patient.id,
        clinicId,
        patientClinicId: patientLink.id,
        userId: user.id,
        accessAction: 'download_attachment',
        purposeCode: filters.purposeCode,
        purposeNote: filters.purposeNote,
        attachmentId: attachment.id,
      })

      response.header('Cache-Control', 'private, no-store')
      response.header('Content-Type', attachment.contentType)
      response.header('Content-Length', fileContents.byteLength)
      response.header('X-Content-Type-Options', 'nosniff')
      response.header('Content-Disposition', buildContentDisposition(attachment.originalName))

      return response.send(Buffer.from(fileContents))
    } catch (error) {
      if (error instanceof AttachmentRequestError) {
        return respondForAttachmentError({
          error,
          response,
        })
      }

      throw error
    }
  }
}
