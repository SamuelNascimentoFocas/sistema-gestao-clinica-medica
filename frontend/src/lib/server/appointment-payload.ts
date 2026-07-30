import "server-only";

type PayloadResult =
  | {
      ok: true;
      value: Record<string, unknown>;
    }
  | {
      ok: false;
      status: 400 | 422;
      message: string;
    };

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function invalidPayload(message: string): PayloadResult {
  return {
    ok: false,
    status: 422,
    message,
  };
}

export function parseCreateAppointmentPayload(
  body: unknown,
): PayloadResult {
  if (!isObject(body)) {
    return {
      ok: false,
      status: 400,
      message: "Corpo da requisição inválido",
    };
  }

  const allowedFields = [
    "patientClinicId",
    "clinicProfessionalId",
    "startsAt",
    "durationMinutes",
    "appointmentTypeCode",
    "administrativeNote",
  ];

  if (
    !Object.keys(body).every((field) =>
      allowedFields.includes(field),
    )
  ) {
    return invalidPayload(
      "A requisição contém campos não permitidos",
    );
  }

  if (
    typeof body.patientClinicId !== "string" ||
    !body.patientClinicId.trim()
  ) {
    return invalidPayload("Paciente inválido");
  }

  if (
    typeof body.clinicProfessionalId !== "string" ||
    !body.clinicProfessionalId.trim()
  ) {
    return invalidPayload("Profissional inválido");
  }

  if (
    typeof body.startsAt !== "string" ||
    Number.isNaN(Date.parse(body.startsAt))
  ) {
    return invalidPayload("Data e horário inválidos");
  }

  const payload: Record<string, unknown> = {
    patientClinicId: body.patientClinicId.trim(),
    clinicProfessionalId:
      body.clinicProfessionalId.trim(),
    startsAt: new Date(body.startsAt).toISOString(),
  };

  if (body.durationMinutes !== undefined) {
    if (
      typeof body.durationMinutes !== "number" ||
      !Number.isInteger(body.durationMinutes) ||
      body.durationMinutes < 5 ||
      body.durationMinutes > 480
    ) {
      return invalidPayload(
        "A duração deve estar entre 5 e 480 minutos",
      );
    }

    payload.durationMinutes = body.durationMinutes;
  }

  for (const field of [
    "appointmentTypeCode",
    "administrativeNote",
  ] as const) {
    const value = body[field];

    if (value === undefined || value === null) {
      payload[field] = null;
      continue;
    }

    if (typeof value !== "string") {
      return invalidPayload(
        field === "appointmentTypeCode"
          ? "Tipo de atendimento inválido"
          : "Observação administrativa inválida",
      );
    }

    const normalized = value.trim();
    const maximumLength =
      field === "appointmentTypeCode" ? 60 : 500;

    if (normalized.length > maximumLength) {
      return invalidPayload(
        field === "appointmentTypeCode"
          ? "O tipo ultrapassa 60 caracteres"
          : "A observação ultrapassa 500 caracteres",
      );
    }

    payload[field] = normalized || null;
  }

  return {
    ok: true,
    value: payload,
  };
}

export function parseUpdateAppointmentPayload(
  body: unknown,
): PayloadResult {
  if (!isObject(body)) {
    return {
      ok: false,
      status: 400,
      message: "Corpo da requisição inválido",
    };
  }

  const allowedFields = [
    "patientClinicId",
    "appointmentTypeCode",
    "administrativeNote",
    "expectedVersion",
  ];

  if (
    !Object.keys(body).every((field) =>
      allowedFields.includes(field),
    )
  ) {
    return invalidPayload(
      "A requisição contém campos não permitidos",
    );
  }

  if (
    typeof body.expectedVersion !== "number" ||
    !Number.isInteger(body.expectedVersion) ||
    body.expectedVersion < 1
  ) {
    return invalidPayload(
      "A versão do agendamento é inválida",
    );
  }

  const payload: Record<string, unknown> = {
    expectedVersion: body.expectedVersion,
  };

  let hasMutableField = false;

  if ("patientClinicId" in body) {
    if (
      typeof body.patientClinicId !== "string" ||
      !body.patientClinicId.trim()
    ) {
      return invalidPayload("Paciente inválido");
    }

    payload.patientClinicId =
      body.patientClinicId.trim();

    hasMutableField = true;
  }

  if ("appointmentTypeCode" in body) {
    const value = body.appointmentTypeCode;

    if (value === null) {
      payload.appointmentTypeCode = null;
    } else if (typeof value !== "string") {
      return invalidPayload(
        "Tipo de atendimento inválido",
      );
    } else {
      const normalized = value.trim();

      if (normalized.length > 60) {
        return invalidPayload(
          "O tipo de atendimento ultrapassa 60 caracteres",
        );
      }

      payload.appointmentTypeCode =
        normalized || null;
    }

    hasMutableField = true;
  }

  if ("administrativeNote" in body) {
    const value = body.administrativeNote;

    if (value === null) {
      payload.administrativeNote = null;
    } else if (typeof value !== "string") {
      return invalidPayload(
        "Observação administrativa inválida",
      );
    } else {
      const normalized = value.trim();

      if (normalized.length > 500) {
        return invalidPayload(
          "A observação administrativa ultrapassa 500 caracteres",
        );
      }

      payload.administrativeNote =
        normalized || null;
    }

    hasMutableField = true;
  }

  if (!hasMutableField) {
    return {
      ok: false,
      status: 400,
      message:
        "Informe pelo menos um campo para atualização",
    };
  }

  return {
    ok: true,
    value: payload,
  };
}

const CANCELLATION_REASON_CODES = new Set([
  "patient_request",
  "professional_unavailable",
  "clinic_request",
  "duplicate",
  "created_by_mistake",
  "other",
]);

function readExpectedVersion(
  body: Record<string, unknown>,
) {
  if (
    typeof body.expectedVersion !== "number" ||
    !Number.isInteger(body.expectedVersion) ||
    body.expectedVersion < 1
  ) {
    return null;
  }

  return body.expectedVersion;
}

export function parseAppointmentVersionPayload(
  body: unknown,
): PayloadResult {
  if (!isObject(body)) {
    return {
      ok: false,
      status: 400,
      message: "Corpo da requisição inválido",
    };
  }

  if (
    !Object.keys(body).every(
      (field) => field === "expectedVersion",
    )
  ) {
    return invalidPayload(
      "A requisição contém campos não permitidos",
    );
  }

  const expectedVersion = readExpectedVersion(body);

  if (expectedVersion === null) {
    return invalidPayload(
      "A versão do agendamento é inválida",
    );
  }

  return {
    ok: true,
    value: {
      expectedVersion,
    },
  };
}

export function parseCancelAppointmentPayload(
  body: unknown,
): PayloadResult {
  if (!isObject(body)) {
    return {
      ok: false,
      status: 400,
      message: "Corpo da requisição inválido",
    };
  }

  const allowedFields = [
    "expectedVersion",
    "cancellationReasonCode",
    "cancellationNote",
  ];

  if (
    !Object.keys(body).every((field) =>
      allowedFields.includes(field),
    )
  ) {
    return invalidPayload(
      "A requisição contém campos não permitidos",
    );
  }

  const expectedVersion = readExpectedVersion(body);

  if (expectedVersion === null) {
    return invalidPayload(
      "A versão do agendamento é inválida",
    );
  }

  if (
    typeof body.cancellationReasonCode !== "string" ||
    !CANCELLATION_REASON_CODES.has(
      body.cancellationReasonCode,
    )
  ) {
    return invalidPayload(
      "O motivo do cancelamento é inválido",
    );
  }

  const payload: Record<string, unknown> = {
    expectedVersion,
    cancellationReasonCode:
      body.cancellationReasonCode,
  };

  if (
    body.cancellationNote === undefined ||
    body.cancellationNote === null
  ) {
    payload.cancellationNote = null;
  } else if (
    typeof body.cancellationNote !== "string"
  ) {
    return invalidPayload(
      "A observação do cancelamento é inválida",
    );
  } else {
    const normalized =
      body.cancellationNote.trim();

    if (normalized.length > 500) {
      return invalidPayload(
        "A observação do cancelamento ultrapassa 500 caracteres",
      );
    }

    payload.cancellationNote =
      normalized || null;
  }

  return {
    ok: true,
    value: payload,
  };
}

export function parseRescheduleAppointmentPayload(
  body: unknown,
): PayloadResult {
  if (!isObject(body)) {
    return {
      ok: false,
      status: 400,
      message: "Corpo da requisição inválido",
    };
  }

  const allowedFields = [
    "expectedVersion",
    "clinicProfessionalId",
    "startsAt",
    "durationMinutes",
    "cancellationNote",
  ];

  if (
    !Object.keys(body).every((field) =>
      allowedFields.includes(field),
    )
  ) {
    return invalidPayload(
      "A requisição contém campos não permitidos",
    );
  }

  const expectedVersion = readExpectedVersion(body);

  if (expectedVersion === null) {
    return invalidPayload(
      "A versão do agendamento é inválida",
    );
  }

  if (
    typeof body.startsAt !== "string" ||
    Number.isNaN(Date.parse(body.startsAt))
  ) {
    return invalidPayload(
      "A nova data e o novo horário são inválidos",
    );
  }

  const payload: Record<string, unknown> = {
    expectedVersion,
    startsAt: new Date(body.startsAt).toISOString(),
  };

  if (body.clinicProfessionalId !== undefined) {
    if (
      typeof body.clinicProfessionalId !== "string" ||
      !body.clinicProfessionalId.trim()
    ) {
      return invalidPayload(
        "O profissional informado é inválido",
      );
    }

    payload.clinicProfessionalId =
      body.clinicProfessionalId.trim();
  }

  if (body.durationMinutes !== undefined) {
    if (
      typeof body.durationMinutes !== "number" ||
      !Number.isInteger(body.durationMinutes) ||
      body.durationMinutes < 5 ||
      body.durationMinutes > 480
    ) {
      return invalidPayload(
        "A duração deve estar entre 5 e 480 minutos",
      );
    }

    payload.durationMinutes =
      body.durationMinutes;
  }

  if (
    body.cancellationNote === undefined ||
    body.cancellationNote === null
  ) {
    payload.cancellationNote = null;
  } else if (
    typeof body.cancellationNote !== "string"
  ) {
    return invalidPayload(
      "A observação do reagendamento é inválida",
    );
  } else {
    const normalized =
      body.cancellationNote.trim();

    if (normalized.length > 500) {
      return invalidPayload(
        "A observação do reagendamento ultrapassa 500 caracteres",
      );
    }

    payload.cancellationNote =
      normalized || null;
  }

  return {
    ok: true,
    value: payload,
  };
}