import assert from "node:assert/strict";
import test from "node:test";
import {
  MEDICAL_RECORD_ACCESS_DENIED_MESSAGE,
  sanitizeMedicalRecordBackendResponse,
} from "../src/lib/medical-records/medical-record-response.ts";

test("medical record 403 responses retain the status with a neutral public message", async () => {
  const response = Response.json(
    {
      message: "O usuário não possui relação clínica ativa com este paciente",
      stack: "private stack",
      professionalId: "private-professional-id",
    },
    {
      status: 403,
      headers: {
        "X-Internal-Reason": "missing-qualifying-appointment",
      },
    },
  );

  const sanitized = sanitizeMedicalRecordBackendResponse(response);
  const serializedBody = await sanitized.text();

  assert.equal(sanitized.status, 403);
  assert.equal(sanitized.headers.get("Cache-Control"), "no-store");
  assert.equal(sanitized.headers.has("X-Internal-Reason"), false);
  assert.deepEqual(JSON.parse(serializedBody), {
    message: MEDICAL_RECORD_ACCESS_DENIED_MESSAGE,
  });
  assert.equal(serializedBody.includes("relação clínica"), false);
  assert.equal(serializedBody.includes("private-professional-id"), false);
  assert.equal(serializedBody.includes("private stack"), false);
});

test("non-403 responses preserve authentication and resource semantics", () => {
  for (const status of [200, 201, 400, 401, 404, 422, 500, 503]) {
    const response = Response.json({ status }, { status });

    assert.equal(
      sanitizeMedicalRecordBackendResponse(response),
      response,
    );
  }
});
