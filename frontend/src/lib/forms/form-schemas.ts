import { z } from "zod";

// These schemas validate browser values, not normalized BFF payloads. In
// particular, optional strings stay strings (including ""), and IDs are not
// narrowed to a new UUID version. HTTP serializers remain in each form.
const requiredText = z.string().min(1, "Preencha este campo.");
const text = (max: number) =>
  z.string().max(max, `Use no máximo ${max} caracteres.`);

// HTML type=email accepts addresses (including a single-label domain) which
// Zod's default email validator rejects. Keep the existing HTML grammar.
const htmlEmail =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const email = z
  .string()
  .refine(
    (value) => value === "" || htmlEmail.test(value),
    "Informe um e-mail válido.",
  );

export const loginFormSchema = z.object({
  email: email.and(requiredText),
  // Login previously only required a nonempty password in the browser.
  password: requiredText,
});

export const memberFormSchema = z.object({
  fullName: text(180).min(3, "Use ao menos 3 caracteres."),
  email: email.and(requiredText).and(text(254)),
  roleId: z.string().uuid("Selecione um perfil válido."),
});

const invitationPassword = z
  .string()
  .min(12, "Use ao menos 12 caracteres.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "A senha ultrapassa o limite de 72 bytes.",
  );

export const invitationPasswordFormSchema = z
  .object({
    password: invitationPassword,
    passwordConfirmation: invitationPassword,
  })
  .refine(({ password, passwordConfirmation }) => password === passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "As senhas devem ser iguais.",
  });

export const customRoleFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Use ao menos 3 caracteres.")
    .max(120, "Use no máximo 120 caracteres."),
  description: z.string().max(255, "Use no máximo 255 caracteres."),
  permissionCodes: z.array(z.string().min(1)),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type MemberFormValues = z.infer<typeof memberFormSchema>;
export type InvitationPasswordFormValues = z.infer<
  typeof invitationPasswordFormSchema
>;
export type CustomRoleFormValues = z.infer<typeof customRoleFormSchema>;

// Create/edit intentionally submit the same complete set of browser fields.
// CPF, CEP and UF keep their existing onChange normalization and HTML maxima;
// completeness checks performed only by the BFF are not added here.
export const patientFormSchema = (today: string) =>
  z.object({
    fullName: text(180).min(3, "Use ao menos 3 caracteres."),
    birthDate: requiredText.refine(
      (value) => value <= today,
      "A data de nascimento não pode estar no futuro.",
    ),
    cpf: text(11),
    phone: text(20),
    email: email.and(text(254)),
    addressStreet: text(180),
    addressNumber: text(30),
    addressComplement: text(120),
    addressNeighborhood: text(120),
    addressCity: text(120),
    addressState: text(2),
    addressPostalCode: text(8),
    localRecordNumber: text(60),
  });

// Numeric inputs stay strings until the existing submit handler uses Number.
const duration = requiredText.refine(
  (value) =>
    Number.isInteger(Number(value)) &&
    Number(value) >= 5 &&
    Number(value) <= 480,
  "A duração deve estar entre 5 e 480 minutos",
);

const professionalLinkFields = {
  localCode: text(60),
  defaultAppointmentDurationMinutes: duration,
  acceptsAppointments: z.boolean(),
};

export const professionalFormSchema = z.object({
  fullName: text(180).min(3, "Use ao menos 3 caracteres."),
  crmNumber: text(30).min(1, "Preencha este campo."),
  crmState: text(2).min(2, "Informe a UF com 2 letras."),
  specialty: text(120).min(2, "Use ao menos 2 caracteres."),
  phone: text(20),
  email: email.and(text(254)),
  userId: z.string(),
  ...professionalLinkFields,
});

export const professionalLinkFormSchema = z.object(professionalLinkFields);

export const weeklyAvailabilityFormSchema = z.object({
  weekday: z
    .string()
    .refine(
      (value) => ["1", "2", "3", "4", "5", "6", "7"].includes(value),
      "Selecione um dia da semana.",
    ),
  startTime: requiredText,
  endTime: requiredText,
  // Native time inputs are retained. Ordering remains a BFF/Service rule,
  // since this form did not previously reject it in the browser.
});

export const scheduleBlockFormSchema = z
  .object({
    startsAt: requiredText.refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      "Informe datas e horários válidos",
    ),
    endsAt: requiredText.refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      "Informe datas e horários válidos",
    ),
    reason: text(240),
  })
  .refine(
    ({ startsAt, endsAt }) => {
      const start = new Date(startsAt).getTime();
      const end = new Date(endsAt).getTime();
      return Number.isNaN(start) || Number.isNaN(end) || start < end;
    },
    {
      path: ["endsAt"],
      message: "O início do bloqueio deve ser anterior ao fim",
    },
  );

const appointmentFields = {
  patientClinicId: requiredText,
  appointmentTypeCode: text(60),
  administrativeNote: text(500),
};

export const appointmentFormSchema = z.object({
  ...appointmentFields,
  clinicProfessionalId: requiredText,
  // The current clinic-timezone helper still validates/converts this value.
  startsAt: requiredText,
  durationMinutes: duration,
});

export const appointmentEditFormSchema = z.object(appointmentFields);

export const appointmentRescheduleFormSchema = z.object({
  clinicProfessionalId: requiredText,
  startsAt: requiredText,
  durationMinutes: duration,
  cancellationNote: text(500),
});

export const appointmentCancellationFormSchema = z.object({
  cancellationReasonCode: z.enum([
    "patient_request",
    "professional_unavailable",
    "clinic_request",
    "duplicate",
    "created_by_mistake",
    "other",
  ]),
  // Unlike medical-record access, cancellation does not require a note for other.
  cancellationNote: text(500),
});

export type AppointmentCancellationFormValues = z.infer<
  typeof appointmentCancellationFormSchema
>;

export const medicalRecordAccessFormSchema = z
  .object({
    selectedPatientId: z
      .string()
      .min(1, "Selecione um paciente para acessar o prontuário."),
    purposeCode: z.enum([
      "patient_care",
      "care_coordination",
      "legal_obligation",
      "other",
    ]),
    purposeNote: text(500),
  })
  .refine(
    ({ purposeCode, purposeNote }) =>
      purposeCode !== "other" || purposeNote.trim().length > 0,
    {
      path: ["purposeNote"],
      message: "Detalhe a finalidade específica do acesso.",
    },
  );

export const medicalRecordEntryFormSchema = z.object({
  entryTypeCode: z.enum(["consultation", "evolution", "other"]),
  content: z
    .string()
    .max(20_000, "O conteúdo deve possuir no máximo 20.000 caracteres.")
    .refine(
      (value) => value.trim().length > 0,
      "Informe o conteúdo da entrada clínica.",
    ),
});

export const medicalRecordCorrectionFormSchema = z.object({
  content: z
    .string()
    .max(20_000, "A correção deve possuir no máximo 20.000 caracteres.")
    .refine(
      (value) => value.trim().length > 0,
      "Informe o conteúdo da correção.",
    ),
});

export type MedicalRecordAccessFormValues = z.infer<
  typeof medicalRecordAccessFormSchema
>;
export type MedicalRecordEntryFormValues = z.infer<
  typeof medicalRecordEntryFormSchema
>;
export type MedicalRecordCorrectionFormValues = z.infer<
  typeof medicalRecordCorrectionFormSchema
>;
