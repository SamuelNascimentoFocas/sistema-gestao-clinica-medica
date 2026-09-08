import env from '#start/env'

export const MEDICAL_RECORD_ATTACHMENT_DEFAULT_MAX_BYTES = 10 * 1024 * 1024

// Matches the database constraint that protects every persisted attachment.
export const MEDICAL_RECORD_ATTACHMENT_ABSOLUTE_MAX_BYTES = 10 * 1024 * 1024

export function resolveMedicalRecordAttachmentMaxBytes(configuredValue?: number) {
  const maxBytes = configuredValue ?? MEDICAL_RECORD_ATTACHMENT_DEFAULT_MAX_BYTES

  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1 ||
    maxBytes > MEDICAL_RECORD_ATTACHMENT_ABSOLUTE_MAX_BYTES
  ) {
    throw new Error(
      'MEDICAL_RECORD_ATTACHMENT_MAX_BYTES must be a positive integer no greater than 10485760'
    )
  }

  return maxBytes
}

const attachmentConfig = {
  maxBytes: resolveMedicalRecordAttachmentMaxBytes(env.get('MEDICAL_RECORD_ATTACHMENT_MAX_BYTES')),
}

export default attachmentConfig
