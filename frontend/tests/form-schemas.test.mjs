import assert from "node:assert/strict";
import test from "node:test";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFormControl } from "react-hook-form";
import {
  localDateTimeToUtcIso,
  formatDateTimeLocalInputInTimeZone,
} from "../src/lib/appointments/appointment-date.ts";
import {
  loginFormSchema,
  memberFormSchema,
  invitationPasswordFormSchema,
  customRoleFormSchema,
  patientFormSchema,
  professionalFormSchema,
  professionalLinkFormSchema,
  weeklyAvailabilityFormSchema,
  scheduleBlockFormSchema,
  appointmentFormSchema,
  appointmentEditFormSchema,
  appointmentRescheduleFormSchema,
  appointmentCancellationFormSchema,
  medicalRecordAccessFormSchema,
  medicalRecordEntryFormSchema,
  medicalRecordCorrectionFormSchema,
} from "../src/lib/forms/form-schemas.ts";

test("login keeps the HTML email grammar and does not add a password limit", () => {
  for (const email of [
    "ana!teste@example.com",
    "ana@localhost",
    "ana+test@example.com",
  ]) {
    const values = { email, password: "x".repeat(100) };
    assert.deepEqual(loginFormSchema.parse(values), values);
  }
  for (const email of ["", "invalid", "a b@example.com"]) {
    assert.equal(
      loginFormSchema.safeParse({ email, password: "x" }).success,
      false,
    );
  }
  assert.equal(
    loginFormSchema.safeParse({ email: "a@b", password: "" }).success,
    false,
  );
});

test("member invitation validation accepts identity and role without an administrator password", () => {
  const roleId = "11111111-1111-4111-8111-111111111111";
  const values = {
    fullName: "  Ana  ",
    email: "ana!teste@example.com",
    roleId,
  };
  assert.deepEqual(memberFormSchema.parse(values), values);
  for (const change of [
    { roleId: "invalid-role" },
    { fullName: "AB" },
  ]) {
    assert.equal(
      memberFormSchema.safeParse({ ...values, ...change }).success,
      false,
    );
  }
});

test("the Zod resolver returns unchanged valid values and accessible field errors", async () => {
  const resolver = zodResolver(memberFormSchema);
  const options = { fields: {}, shouldUseNativeValidation: false };
  const values = {
    fullName: "  Ana  ",
    email: "ana@example.com",
    roleId: "22222222-2222-4222-8222-222222222222",
  };
  assert.deepEqual(await resolver(values, undefined, options), {
    values,
    errors: {},
  });
  const invalid = await resolver(
    { ...values, roleId: "invalid" },
    undefined,
    options,
  );
  assert.deepEqual(invalid.values, {});
  assert.equal(
    invalid.errors.roleId.message,
    "Selecione um perfil válido.",
  );
});

test("invitation password validation enforces characters, UTF-8 bytes and confirmation", () => {
  const accepted = [
    "a".repeat(12),
    "a".repeat(72),
    "á".repeat(30),
    `${"á".repeat(30)}${"a".repeat(12)}`,
  ];

  for (const password of accepted) {
    assert.deepEqual(invitationPasswordFormSchema.parse({
      password,
      passwordConfirmation: password,
    }), {
      password,
      passwordConfirmation: password,
    });
  }

  for (const password of [
    "a".repeat(11),
    "a".repeat(73),
    "á".repeat(37),
  ]) {
    assert.equal(invitationPasswordFormSchema.safeParse({
      password,
      passwordConfirmation: password,
    }).success, false);
  }

  assert.equal(invitationPasswordFormSchema.safeParse({
    password: "a".repeat(12),
    passwordConfirmation: "b".repeat(12),
  }).success, false);
});

test("custom role validation keeps the backend name and description limits", () => {
  const values = {
    name: "  Apoio clínico  ",
    description: "Permissões assistenciais",
    permissionCodes: ["patients.read", "medical_records.read"],
  };
  assert.deepEqual(customRoleFormSchema.parse(values), {
    ...values,
    name: "Apoio clínico",
  });
  for (const change of [
    { name: "AB" },
    { name: "x".repeat(121) },
    { description: "x".repeat(256) },
  ]) {
    assert.equal(
      customRoleFormSchema.safeParse({ ...values, ...change }).success,
      false,
    );
  }
});

test("patient create/edit retain all optional strings and the existing browser limits", () => {
  const values = {
    fullName: " Ana ",
    birthDate: "2000-01-01",
    cpf: "",
    phone: "",
    email: "",
    addressStreet: "",
    addressNumber: "",
    addressComplement: "",
    addressNeighborhood: "",
    addressCity: "",
    addressState: "",
    addressPostalCode: "",
    localRecordNumber: "",
  };
  const schema = patientFormSchema("2026-09-03");
  assert.deepEqual(schema.parse(values), values);
  // Incomplete optional identifiers were already delegated to the BFF.
  const partial = {
    ...values,
    cpf: "123",
    addressState: "M",
    addressPostalCode: "12",
    addressStreet: "   ",
  };
  assert.deepEqual(schema.parse(partial), partial);
  for (const change of [
    { fullName: "AB" },
    { birthDate: "" },
    { birthDate: "2026-09-04" },
    { phone: "1".repeat(21) },
    { cpf: "1".repeat(12) },
    { addressState: "ABC" },
    { email: "invalid" },
  ]) {
    assert.equal(schema.safeParse({ ...values, ...change }).success, false);
  }
});

test("professional values keep empty links, boolean flags and string durations until serialization", () => {
  const values = {
    fullName: "Ana Silva",
    crmNumber: "123",
    crmState: "MG",
    specialty: "Clínica",
    phone: "",
    email: "",
    userId: "",
    localCode: " ",
    defaultAppointmentDurationMinutes: "030",
    acceptsAppointments: false,
  };
  assert.deepEqual(professionalFormSchema.parse(values), values);
  const link = {
    localCode: "",
    defaultAppointmentDurationMinutes: "5",
    acceptsAppointments: true,
  };
  assert.deepEqual(professionalLinkFormSchema.parse(link), link);
  for (const value of ["", "4", "481", "5.5", "invalid"]) {
    assert.equal(
      professionalLinkFormSchema.safeParse({
        ...link,
        defaultAppointmentDurationMinutes: value,
      }).success,
      false,
    );
  }
  // No new UUID version rule: the existing select and BFF retain that responsibility.
  const v7 = { ...values, userId: "018f47a0-7b19-7c2d-8f4d-8bca572da998" };
  assert.deepEqual(professionalFormSchema.parse(v7), v7);
});

test("weekly availability keeps time strings and leaves ordering with the existing BFF", () => {
  const values = { weekday: "7", startTime: "12:00", endTime: "08:00" };
  assert.deepEqual(weeklyAvailabilityFormSchema.parse(values), values);
  assert.equal(
    weeklyAvailabilityFormSchema.safeParse({ ...values, weekday: "0" }).success,
    false,
  );
  assert.equal(
    weeklyAvailabilityFormSchema.safeParse({ ...values, startTime: "" })
      .success,
    false,
  );
});

test("schedule blocks preserve local date strings and their preexisting ordering check", () => {
  const values = {
    startsAt: "2026-09-03T08:00",
    endsAt: "2026-09-03T12:00",
    reason: " ",
  };
  assert.deepEqual(scheduleBlockFormSchema.parse(values), values);
  for (const change of [
    { startsAt: "invalid" },
    { endsAt: values.startsAt },
    { endsAt: "2026-09-03T07:00" },
    { reason: "x".repeat(241) },
  ]) {
    assert.equal(
      scheduleBlockFormSchema.safeParse({ ...values, ...change }).success,
      false,
    );
  }
});

test("appointments retain string durations, selected IDs, complete edit fields and optional notes", () => {
  const values = {
    patientClinicId: "018f47a0-7b19-7c2d-8f4d-8bca572da998",
    clinicProfessionalId: "selected-professional",
    startsAt: "2026-09-03T08:30",
    durationMinutes: "030",
    appointmentTypeCode: "",
    administrativeNote: " ",
  };
  assert.deepEqual(appointmentFormSchema.parse(values), values);
  const edit = {
    patientClinicId: values.patientClinicId,
    appointmentTypeCode: "",
    administrativeNote: "",
  };
  assert.deepEqual(appointmentEditFormSchema.parse(edit), edit);
  const reschedule = {
    clinicProfessionalId: values.clinicProfessionalId,
    startsAt: values.startsAt,
    durationMinutes: values.durationMinutes,
    cancellationNote: "",
  };
  assert.deepEqual(
    appointmentRescheduleFormSchema.parse(reschedule),
    reschedule,
  );
  for (const change of [
    { patientClinicId: "" },
    { startsAt: "" },
    { durationMinutes: "4.5" },
    { administrativeNote: "x".repeat(501) },
  ]) {
    assert.equal(
      appointmentFormSchema.safeParse({ ...values, ...change }).success,
      false,
    );
  }
});

test("cancellation keeps its six reasons and does not require a note for other", () => {
  for (const cancellationReasonCode of [
    "patient_request",
    "professional_unavailable",
    "clinic_request",
    "duplicate",
    "created_by_mistake",
    "other",
  ]) {
    const values = { cancellationReasonCode, cancellationNote: "" };
    assert.deepEqual(appointmentCancellationFormSchema.parse(values), values);
  }
  assert.equal(
    appointmentCancellationFormSchema.safeParse({
      cancellationReasonCode: "rescheduled",
      cancellationNote: "",
    }).success,
    false,
  );
});

test("medical-record access retains the purpose note and requires it only for other", () => {
  const values = {
    selectedPatientId: "selected-patient",
    purposeCode: "patient_care",
    purposeNote: "  previous note  ",
  };
  assert.deepEqual(medicalRecordAccessFormSchema.parse(values), values);
  assert.equal(
    medicalRecordAccessFormSchema.safeParse({
      ...values,
      purposeCode: "other",
      purposeNote: "   ",
    }).success,
    false,
  );
  assert.equal(
    medicalRecordAccessFormSchema.safeParse({
      ...values,
      selectedPatientId: "",
    }).success,
    false,
  );
  assert.equal(
    medicalRecordAccessFormSchema.safeParse({ ...values, purposeCode: "other" })
      .success,
    true,
  );
});

test("clinical entry and correction validate without replacing the existing payload trim", () => {
  const entry = {
    entryTypeCode: "evolution",
    content: "  Conteúdo clínico sintético.  ",
  };
  assert.deepEqual(medicalRecordEntryFormSchema.parse(entry), entry);
  assert.deepEqual(
    medicalRecordCorrectionFormSchema.parse({ content: entry.content }),
    { content: entry.content },
  );
  for (const content of ["", "  ", "x".repeat(20_001)]) {
    assert.equal(
      medicalRecordEntryFormSchema.safeParse({ ...entry, content }).success,
      false,
    );
    assert.equal(
      medicalRecordCorrectionFormSchema.safeParse({ content }).success,
      false,
    );
  }
  assert.equal(
    medicalRecordEntryFormSchema.safeParse({
      ...entry,
      content: "x".repeat(20_000),
    }).success,
    true,
  );
});

test("RHF keeps complete edit values, applies resets and awaits the submission callback", async () => {
  const defaults = {
    patientClinicId: "selected-patient",
    appointmentTypeCode: "",
    administrativeNote: "initial",
  };
  const form = createFormControl({
    defaultValues: defaults,
    resolver: zodResolver(appointmentEditFormSchema),
  });
  const states = [];
  const unsubscribe = form.subscribe({
    formState: { values: true, isSubmitting: true },
    callback: (state) => states.push(state.isSubmitting),
  });
  for (const field of Object.keys(defaults)) form.register(field);
  await form.register("administrativeNote").onChange({
    target: { name: "administrativeNote", value: "  edited  " },
    type: "change",
  });
  await form.handleSubmit(async (values) => {
    assert.equal(states.at(-1), true);
    assert.deepEqual(values, { ...defaults, administrativeNote: "  edited  " });
    await Promise.resolve();
    assert.equal(states.at(-1), true);
  })();
  assert.equal(states.at(-1), false);
  form.reset(defaults);
  assert.deepEqual(form.getValues(), defaults);
  form.setValue("patientClinicId", "");
  await form.handleSubmit(() =>
    assert.fail("Invalid input must not reach the HTTP callback"),
  )();
  assert.ok(form.getFieldState("patientClinicId").error);
  unsubscribe();
});

test("RHF retains a hidden purpose note and clears only clinical content after success", () => {
  const defaults = {
    selectedPatientId: "patient",
    purposeCode: "other",
    purposeNote: "  reason  ",
  };
  const access = createFormControl({
    defaultValues: defaults,
    resolver: zodResolver(medicalRecordAccessFormSchema),
  });
  const stopAccess = access.subscribe({
    formState: { values: true },
    callback: () => {},
  });
  const note = access.register("purposeNote");
  access.register("purposeCode");
  access.setValue("purposeCode", "patient_care");
  note.ref(null);
  assert.equal(access.getValues("purposeNote"), defaults.purposeNote);
  access.setValue("purposeCode", "other");
  assert.deepEqual(access.getValues(), defaults);
  stopAccess();

  const entry = createFormControl({
    defaultValues: { entryTypeCode: "evolution", content: "synthetic" },
    resolver: zodResolver(medicalRecordEntryFormSchema),
  });
  const stopEntry = entry.subscribe({
    formState: { values: true },
    callback: () => {},
  });
  entry.register("entryTypeCode");
  entry.register("content");
  entry.resetField("content", { defaultValue: "" });
  assert.deepEqual(entry.getValues(), {
    entryTypeCode: "evolution",
    content: "",
  });
  stopEntry();
});

test("appointment date values still use the existing explicit clinic timezone helper", () => {
  const local = "2026-09-03T08:30";
  assert.equal(
    localDateTimeToUtcIso(local, "America/Sao_Paulo"),
    "2026-09-03T11:30:00.000Z",
  );
  assert.equal(localDateTimeToUtcIso(local, "UTC"), "2026-09-03T08:30:00.000Z");
  assert.equal(
    formatDateTimeLocalInputInTimeZone(
      "2026-09-03T11:30:00.000Z",
      "America/Sao_Paulo",
    ),
    local,
  );
  assert.throws(() =>
    localDateTimeToUtcIso("2026-02-30T08:30", "America/Sao_Paulo"),
  );
});
