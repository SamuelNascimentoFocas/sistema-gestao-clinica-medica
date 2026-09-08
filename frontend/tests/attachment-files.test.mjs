import assert from "node:assert/strict";
import test from "node:test";
import {
  MEDICAL_RECORD_ATTACHMENT_MAX_FILES,
  formatAttachmentFileSize,
  getAttachmentFileMetadata,
  getSafeAttachmentUploadErrorMessage,
  isLocalAttachmentPreviewable,
  validateAttachmentSelection,
} from "../src/lib/medical-records/attachment-files.ts";

function file(overrides = {}) {
  return {
    name: "arquivo.bin",
    size: 1024,
    type: "application/octet-stream",
    ...overrides,
  };
}

test("arbitrary and extensionless files are not blocked by a browser or BFF allowlist", () => {
  assert.equal(MEDICAL_RECORD_ATTACHMENT_MAX_FILES, 2);
  assert.deepEqual(
    validateAttachmentSelection([
      file({
        name: "dados-clinicos",
        size: Number.MAX_SAFE_INTEGER,
        type: "application/x-custom-clinical-data",
      }),
    ]),
    { ok: true },
  );
});

test("selection validation retains quantity, name and non-empty checks", () => {
  assert.equal(validateAttachmentSelection([]).ok, false);
  assert.equal(
    validateAttachmentSelection([file(), file(), file()]).ok,
    false,
  );
  assert.equal(
    validateAttachmentSelection([file({ name: " " })]).ok,
    false,
  );
  assert.equal(
    validateAttachmentSelection([file({ size: 0 })]).ok,
    false,
  );
});

test("only local JPEG and PNG files are previewable", () => {
  for (const contentType of ["image/jpeg", "image/png"]) {
    assert.equal(isLocalAttachmentPreviewable(contentType), true);
  }

  for (const contentType of [
    "application/pdf",
    "image/svg+xml",
    "text/html",
    "application/javascript",
    "application/octet-stream",
    "",
  ]) {
    assert.equal(isLocalAttachmentPreviewable(contentType), false);
  }
});

test("selected-file metadata remains available without interpreting its contents", () => {
  assert.deepEqual(
    getAttachmentFileMetadata(
      file({
        name: "evidencia.sem-extensao",
        size: 1536,
        type: "",
      }),
    ),
    {
      originalName: "evidencia.sem-extensao",
      sizeInBytes: 1536,
      formattedSize: "1,5 KB",
      declaredContentType: "Tipo não informado",
      previewable: false,
    },
  );
  assert.equal(formatAttachmentFileSize(2 * 1024 * 1024), "2 MB");
});

test("safe upload errors expose only a public message instead of the raw response", () => {
  const body = {
    message: "Validation failure",
    errors: [{ message: "O arquivo ultrapassa o limite configurado" }],
    stack: "private stack",
    storageKey: "private/storage/key",
  };

  assert.equal(
    getSafeAttachmentUploadErrorMessage(body),
    "O arquivo ultrapassa o limite configurado",
  );
  assert.equal(getSafeAttachmentUploadErrorMessage("raw failure"), null);
});
