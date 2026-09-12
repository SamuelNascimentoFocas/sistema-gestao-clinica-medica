import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import drive from '@adonisjs/drive/services/main'
import DomainError from '#exceptions/domain_error'
import attachmentConfig from '#config/attachments'

export const ATTACHMENT_STORAGE_DISK = 'private_fs' as const
export const OPAQUE_ATTACHMENT_CONTENT_TYPE = 'application/octet-stream' as const
const SAFE_ATTACHMENT_DOWNLOAD_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
])
const CONTENT_TYPE_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i

function normalizeOriginalName(clientName: string) {
  const normalizedPath = clientName.replaceAll('\\', '/')
  const originalName = normalizedPath.split('/').pop()?.trim() ?? ''

  if (!originalName) {
    throw new DomainError('invalid', 'O nome original do arquivo é obrigatório')
  }

  if (originalName.length > 255) {
    throw new DomainError(
      'invalid',
      'O nome original do arquivo não pode ultrapassar 255 caracteres'
    )
  }

  return originalName
}

function resolveContentType(file: MultipartFile) {
  const type = file.type?.toLowerCase()
  const subtype = file.subtype?.toLowerCase()

  const contentType = type?.includes('/') ? type : type && subtype ? `${type}/${subtype}` : null

  if (!contentType || contentType.length > 255 || !CONTENT_TYPE_PATTERN.test(contentType)) {
    return OPAQUE_ATTACHMENT_CONTENT_TYPE
  }

  return contentType
}

export function resolveAttachmentDownloadContentType(contentType: string) {
  const normalizedContentType = contentType.trim().toLowerCase()

  return SAFE_ATTACHMENT_DOWNLOAD_CONTENT_TYPES.has(normalizedContentType)
    ? normalizedContentType
    : OPAQUE_ATTACHMENT_CONTENT_TYPE
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

export async function prepareAttachmentFiles(
  files: MultipartFile[],
  medicalRecordId: string,
  entryId: string
) {
  const preparedFiles = await Promise.all(
    files.map(async (file) => {
      if (!file.tmpPath) {
        throw new DomainError('invalid', 'O arquivo não foi processado corretamente')
      }

      if (file.size < 1) {
        throw new DomainError('invalid', 'O arquivo não pode estar vazio')
      }

      if (file.size > attachmentConfig.maxBytes) {
        throw new DomainError('invalid', 'O arquivo ultrapassa o limite configurado')
      }

      const originalName = normalizeOriginalName(file.clientName)
      const contentType = resolveContentType(file)
      const sha256 = await calculateSha256(file.tmpPath)

      const storageKey = `medical-records/${medicalRecordId}/entries/${entryId}/${randomUUID()}`

      return {
        file,
        originalName,
        contentType,
        sha256,
        storageKey,
      }
    })
  )

  return preparedFiles
}

type PreparedFile = Awaited<ReturnType<typeof prepareAttachmentFiles>>[number]

export async function moveAttachmentFile(preparedFile: PreparedFile) {
  await preparedFile.file.moveToDisk(preparedFile.storageKey, ATTACHMENT_STORAGE_DISK)
}

export async function removeMovedAttachments(storageKeys: string[]) {
  const disk = drive.use(ATTACHMENT_STORAGE_DISK)
  await Promise.allSettled(storageKeys.map((storageKey) => disk.delete(storageKey)))
}

export async function readAttachmentBytes(storageDisk: string, storageKey: string) {
  if (storageDisk !== ATTACHMENT_STORAGE_DISK) {
    throw new DomainError(
      'storage_unavailable',
      'O anexo está associado a um armazenamento não configurado'
    )
  }
  const disk = drive.use(ATTACHMENT_STORAGE_DISK)
  if (!(await disk.exists(storageKey))) {
    throw new DomainError('conflict', 'O arquivo físico do anexo está indisponível')
  }
  return disk.getBytes(storageKey)
}
