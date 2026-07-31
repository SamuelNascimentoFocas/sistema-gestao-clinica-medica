import "server-only";

import type {
  MedicalRecordAccessPurpose,
  MedicalRecordEntryType,
} from "@/types/medical-record";

type MedicalRecordPayloadResult =
  | {
      ok: true;
      value: Record<string, unknown>;
    }
  | {
      ok: false;
      status: 400 | 422;
      message: string;
    };

const ACCESS_PURPOSES =
  new Set<MedicalRecordAccessPurpose>([
    "patient_care",
    "care_coordination",
    "legal_obligation",
    "other",
  ]);

const WRITABLE_ENTRY_TYPES = new Set<
  Exclude<MedicalRecordEntryType, "correction">
>(["consultation", "evolution", "other"]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function invalidPayload(
  message: string,
): MedicalRecordPayloadResult {
  return {
    ok: false,
    status: 422,
    message,
  };
}

function hasOnlyAllowedFields(
  body: Record<string, unknown>,
  allowedFields: readonly string[],
) {
  return Object.keys(body).every((field) =>
    allowedFields.includes(field),
  );
}

function parseClinicalContent(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (
    normalized.length < 1 ||
    normalized.length > 20_000
  ) {
    return null;
  }

  return normalized;
}

export function parseMedicalRecordAccessPayload(
  body: unknown,
): MedicalRecordPayloadResult {
  if (!isObject(body)) {
    return {
      ok: false,
      status: 400,
      message: "Corpo da requisição inválido",
    };
  }

  const allowedFields = [
    "purposeCode",
    "purposeNote",
    "page",
    "perPage",
  ];

  if (!hasOnlyAllowedFields(body, allowedFields)) {
    return invalidPayload(
      "A requisição contém campos não permitidos",
    );
  }

  if (
    typeof body.purposeCode !== "string" ||
    !ACCESS_PURPOSES.has(
      body.purposeCode as MedicalRecordAccessPurpose,
    )
  ) {
    return invalidPayload(
      "A finalidade do acesso é inválida",
    );
  }

  const purposeCode =
    body.purposeCode as MedicalRecordAccessPurpose;

  let purposeNote: string | null = null;

  if (
    body.purposeNote !== undefined &&
    body.purposeNote !== null
  ) {
    if (typeof body.purposeNote !== "string") {
      return invalidPayload(
        "O detalhamento da finalidade é inválido",
      );
    }

    purposeNote = body.purposeNote.trim() || null;

    if (
      purposeNote &&
      purposeNote.length > 500
    ) {
      return invalidPayload(
        "O detalhamento da finalidade ultrapassa 500 caracteres",
      );
    }
  }

  if (
    purposeCode === "other" &&
    purposeNote === null
  ) {
    return invalidPayload(
      "Detalhe a finalidade específica do acesso",
    );
  }

  const page = body.page ?? 1;
  const perPage = body.perPage ?? 20;

  if (
    typeof page !== "number" ||
    !Number.isInteger(page) ||
    page < 1
  ) {
    return invalidPayload("Página inválida");
  }

  if (
    typeof perPage !== "number" ||
    !Number.isInteger(perPage) ||
    perPage < 1 ||
    perPage > 100
  ) {
    return invalidPayload(
      "A quantidade por página deve estar entre 1 e 100",
    );
  }

  return {
    ok: true,
    value: {
      purposeCode,
      purposeNote,
      page,
      perPage,
    },
  };
}

export function parseCreateMedicalRecordEntryPayload(
  body: unknown,
): MedicalRecordPayloadResult {
  if (!isObject(body)) {
    return {
      ok: false,
      status: 400,
      message: "Corpo da requisição inválido",
    };
  }

  const allowedFields = [
    "appointmentId",
    "entryTypeCode",
    "content",
  ];

  if (!hasOnlyAllowedFields(body, allowedFields)) {
    return invalidPayload(
      "A requisição contém campos não permitidos",
    );
  }

  if (
    typeof body.entryTypeCode !== "string" ||
    !WRITABLE_ENTRY_TYPES.has(
      body.entryTypeCode as Exclude<
        MedicalRecordEntryType,
        "correction"
      >,
    )
  ) {
    return invalidPayload(
      "O tipo da entrada clínica é inválido",
    );
  }

  const content = parseClinicalContent(body.content);

  if (content === null) {
    return invalidPayload(
      "O conteúdo clínico deve possuir entre 1 e 20.000 caracteres",
    );
  }

  let appointmentId: string | null = null;

  if (
    body.appointmentId !== undefined &&
    body.appointmentId !== null
  ) {
    if (typeof body.appointmentId !== "string") {
      return invalidPayload(
        "O agendamento informado é inválido",
      );
    }

    const normalizedAppointmentId =
      body.appointmentId.trim();

    if (
      normalizedAppointmentId &&
      !UUID_PATTERN.test(normalizedAppointmentId)
    ) {
      return invalidPayload(
        "O agendamento informado é inválido",
      );
    }

    appointmentId =
      normalizedAppointmentId || null;
  }

  return {
    ok: true,
    value: {
      appointmentId,
      entryTypeCode: body.entryTypeCode,
      content,
    },
  };
}

export function parseCorrectMedicalRecordEntryPayload(
  body: unknown,
): MedicalRecordPayloadResult {
  if (!isObject(body)) {
    return {
      ok: false,
      status: 400,
      message: "Corpo da requisição inválido",
    };
  }

  if (
    !hasOnlyAllowedFields(body, ["content"])
  ) {
    return invalidPayload(
      "A requisição contém campos não permitidos",
    );
  }

  const content = parseClinicalContent(body.content);

  if (content === null) {
    return invalidPayload(
      "A correção deve possuir entre 1 e 20.000 caracteres",
    );
  }

  return {
    ok: true,
    value: {
      content,
    },
  };
}