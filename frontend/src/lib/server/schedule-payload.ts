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

type PayloadMode = "create" | "update";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOnlyAllowedFields(
  body: Record<string, unknown>,
  allowedFields: string[],
) {
  return Object.keys(body).every((field) =>
    allowedFields.includes(field),
  );
}

function invalidPayload(message: string): PayloadResult {
  return {
    ok: false,
    status: 422,
    message,
  };
}

export function parseWeeklyAvailabilityPayload(
  body: unknown,
  mode: PayloadMode,
): PayloadResult {
  if (!isObject(body)) {
    return {
      ok: false,
      status: 400,
      message: "Corpo da requisição inválido",
    };
  }

  const allowedFields = ["weekday", "startTime", "endTime"];

  if (!hasOnlyAllowedFields(body, allowedFields)) {
    return invalidPayload(
      "A requisição contém campos não permitidos",
    );
  }

  const payload: Record<string, unknown> = {};

  if (mode === "create" || "weekday" in body) {
    const weekday = body.weekday;

    if (
      typeof weekday !== "number" ||
      !Number.isInteger(weekday) ||
      weekday < 1 ||
      weekday > 7
    ) {
      return invalidPayload(
        "O dia da semana deve ser um número inteiro entre 1 e 7",
      );
    }

    payload.weekday = weekday;
  }

  for (const field of ["startTime", "endTime"] as const) {
    if (mode !== "create" && !(field in body)) {
      continue;
    }

    const value = body[field];

    if (
      typeof value !== "string" ||
      !timePattern.test(value.trim())
    ) {
      return invalidPayload(
        field === "startTime"
          ? "Horário inicial inválido"
          : "Horário final inválido",
      );
    }

    payload[field] = value.trim();
  }

  if (
    typeof payload.startTime === "string" &&
    typeof payload.endTime === "string" &&
    payload.startTime >= payload.endTime
  ) {
    return invalidPayload(
      "O horário inicial deve ser anterior ao horário final",
    );
  }

  if (
    mode === "update" &&
    Object.keys(payload).length === 0
  ) {
    return {
      ok: false,
      status: 400,
      message: "Informe pelo menos um campo para atualização",
    };
  }

  return {
    ok: true,
    value: payload,
  };
}

function readIsoDate(
  body: Record<string, unknown>,
  field: "startsAt" | "endsAt",
) {
  const value = body[field];

  if (
    typeof value !== "string" ||
    !value.trim() ||
    Number.isNaN(Date.parse(value))
  ) {
    return null;
  }

  return new Date(value).toISOString();
}

export function parseScheduleBlockPayload(
  body: unknown,
  mode: PayloadMode,
): PayloadResult {
  if (!isObject(body)) {
    return {
      ok: false,
      status: 400,
      message: "Corpo da requisição inválido",
    };
  }

  const allowedFields = ["startsAt", "endsAt", "reason"];

  if (!hasOnlyAllowedFields(body, allowedFields)) {
    return invalidPayload(
      "A requisição contém campos não permitidos",
    );
  }

  const payload: Record<string, unknown> = {};

  for (const field of ["startsAt", "endsAt"] as const) {
    if (mode !== "create" && !(field in body)) {
      continue;
    }

    const date = readIsoDate(body, field);

    if (!date) {
      return invalidPayload(
        field === "startsAt"
          ? "Data e hora inicial inválidas"
          : "Data e hora final inválidas",
      );
    }

    payload[field] = date;
  }

  if ("reason" in body) {
    const reason = body.reason;

    if (reason === null) {
      payload.reason = null;
    } else if (typeof reason !== "string") {
      return invalidPayload("Motivo do bloqueio inválido");
    } else {
      const normalizedReason = reason.trim();

      if (normalizedReason.length > 240) {
        return invalidPayload(
          "O motivo do bloqueio ultrapassa 240 caracteres",
        );
      }

      payload.reason = normalizedReason || null;
    }
  }

  if (
    typeof payload.startsAt === "string" &&
    typeof payload.endsAt === "string" &&
    Date.parse(payload.startsAt) >= Date.parse(payload.endsAt)
  ) {
    return invalidPayload(
      "O início do bloqueio deve ser anterior ao fim",
    );
  }

  if (
    mode === "update" &&
    Object.keys(payload).length === 0
  ) {
    return {
      ok: false,
      status: 400,
      message: "Informe pelo menos um campo para atualização",
    };
  }

  return {
    ok: true,
    value: payload,
  };
}

export function parseScheduleStatusPayload(
  body: unknown,
): PayloadResult {
  if (
    !isObject(body) ||
    Object.keys(body).length !== 1 ||
    typeof body.isActive !== "boolean"
  ) {
    return invalidPayload("O status informado é inválido");
  }

  return {
    ok: true,
    value: {
      isActive: body.isActive,
    },
  };
}