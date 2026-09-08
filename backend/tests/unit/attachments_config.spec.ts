import { test } from '@japa/runner'
import attachmentConfig, {
  MEDICAL_RECORD_ATTACHMENT_ABSOLUTE_MAX_BYTES,
  MEDICAL_RECORD_ATTACHMENT_DEFAULT_MAX_BYTES,
  resolveMedicalRecordAttachmentMaxBytes,
} from '#config/attachments'
import {
  OPAQUE_ATTACHMENT_CONTENT_TYPE,
  resolveAttachmentDownloadContentType,
} from '#services/attachment_storage_service'

test.group('Attachment configuration', () => {
  test('uses the existing database ceiling by default and accepts a lower configured limit', ({
    assert,
  }) => {
    assert.equal(MEDICAL_RECORD_ATTACHMENT_DEFAULT_MAX_BYTES, 10 * 1024 * 1024)
    assert.equal(MEDICAL_RECORD_ATTACHMENT_ABSOLUTE_MAX_BYTES, 10 * 1024 * 1024)
    assert.equal(attachmentConfig.maxBytes, MEDICAL_RECORD_ATTACHMENT_DEFAULT_MAX_BYTES)
    assert.equal(resolveMedicalRecordAttachmentMaxBytes(1024), 1024)
  })

  test('rejects invalid or unsafe configured limits', ({ assert }) => {
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => resolveMedicalRecordAttachmentMaxBytes(value))
    }

    assert.throws(() =>
      resolveMedicalRecordAttachmentMaxBytes(MEDICAL_RECORD_ATTACHMENT_ABSOLUTE_MAX_BYTES + 1)
    )
  })

  test('serves active and unclassified media types only as opaque downloads', ({ assert }) => {
    for (const contentType of [
      'text/html',
      'image/svg+xml',
      'application/javascript',
      'application/x-msdownload',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]) {
      assert.equal(
        resolveAttachmentDownloadContentType(contentType),
        OPAQUE_ATTACHMENT_CONTENT_TYPE
      )
    }

    for (const contentType of ['application/pdf', 'image/jpeg', 'image/png']) {
      assert.equal(resolveAttachmentDownloadContentType(contentType), contentType)
    }
  })
})
