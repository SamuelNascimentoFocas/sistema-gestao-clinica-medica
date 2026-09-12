import assert from "node:assert/strict";
import test from "node:test";
import {
  getCompletedAppointmentMedicalRecordHref,
  readOptionalUuidSearchParam,
} from "../src/lib/medical-records/medical-record-entry-context.ts";

const clinicId = "11111111-1111-4111-8111-111111111111";
const patientId = "22222222-2222-4222-8222-222222222222";
const appointmentId = "33333333-3333-4333-8333-333333333333";

function hrefFor(appointmentStatus, canCreateMedicalRecordEntries = true) {
  return getCompletedAppointmentMedicalRecordHref({
    clinicId,
    patientId,
    appointmentId,
    appointmentStatus,
    canCreateMedicalRecordEntries,
  });
}

test("only completed appointments with create permission expose the record action", () => {
  assert.equal(
    hrefFor("completed"),
    `/clinics/${clinicId}/medical-records?patientId=${patientId}&appointmentId=${appointmentId}`,
  );

  for (const status of ["scheduled", "confirmed", "cancelled", "no_show"]) {
    assert.equal(hrefFor(status), null);
  }

  assert.equal(hrefFor("completed", false), null);
});

test("medical-record query context accepts only a single syntactically valid UUID", () => {
  assert.equal(readOptionalUuidSearchParam(appointmentId), appointmentId);
  assert.equal(readOptionalUuidSearchParam(undefined), null);
  assert.equal(readOptionalUuidSearchParam("not-a-uuid"), null);
  assert.equal(readOptionalUuidSearchParam([appointmentId]), null);
});
