import "server-only";

type ProfessionalPayloadMode = "create" | "update";

type ProfessionalPayloadResult =
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function parseProfessionalPayload(
  body: unknown,
  mode: ProfessionalPayloadMode,
): ProfessionalPayloadResult {
  if (!isObject(body)) {
    return {
      ok: false,
      status: 400,
      message: "Corpo da requisição inválido",
    };
  }

  const professionalBody = body;
  const payload: Record<string, unknown> = {};

  const allowedFields =
    mode === "create"
      ? [
          "fullName",
          "crmNumber",
          "crmState",
          "specialty",
          "phone",
          "email",
          "userId",
          "localCode",
          "defaultAppointmentDurationMinutes",
          "acceptsAppointments",
        ]
      : [
          "localCode",
          "defaultAppointmentDurationMinutes",
          "acceptsAppointments",
        ];

  const unexpectedField = Object.keys(
    professionalBody,
  ).find((field) => !allowedFields.includes(field));

  if (unexpectedField) {
    return {
      ok: false,
      status: 422,
      message: `O campo ${unexpectedField} não pode ser enviado nesta operação`,
    };
  }

  function readRequiredText({
    field,
    label,
    minimum,
    maximum,
    pattern,
    transform,
  }: {
    field: string;
    label: string;
    minimum: number;
    maximum: number;
    pattern?: RegExp;
    transform?: (value: string) => string;
  }): string | null {
    const rawValue = professionalBody[field];

    if (typeof rawValue !== "string") {
      return `${label} é obrigatório`;
    }

    const value = rawValue.trim();

    if (
      value.length < minimum ||
      value.length > maximum
    ) {
      return `${label} deve possuir entre ${minimum} e ${maximum} caracteres`;
    }

    if (pattern && !pattern.test(value)) {
      return `${label} inválido`;
    }

    payload[field] = transform
      ? transform(value)
      : value;

    return null;
  }

  function addNullableText({
    field,
    label,
    maximum,
    pattern,
    transform,
  }: {
    field: string;
    label: string;
    maximum: number;
    pattern?: RegExp;
    transform?: (value: string) => string;
  }): string | null {
    if (!(field in professionalBody)) {
      return null;
    }

    const rawValue = professionalBody[field];

    if (rawValue === null) {
      payload[field] = null;

      return null;
    }

    if (typeof rawValue !== "string") {
      return `${label} inválido`;
    }

    const value = rawValue.trim();

    if (!value) {
      payload[field] = null;

      return null;
    }

    if (value.length > maximum) {
      return `${label} ultrapassa o limite de caracteres`;
    }

    if (pattern && !pattern.test(value)) {
      return `${label} inválido`;
    }

    payload[field] = transform
      ? transform(value)
      : value;

    return null;
  }

  const errors: Array<string | null> = [];

  if (mode === "create") {
    errors.push(
      readRequiredText({
        field: "fullName",
        label: "Nome completo",
        minimum: 3,
        maximum: 180,
      }),
      readRequiredText({
        field: "crmNumber",
        label: "Número do CRM",
        minimum: 1,
        maximum: 30,
        transform: (value) => value.toUpperCase(),
      }),
      readRequiredText({
        field: "crmState",
        label: "UF do CRM",
        minimum: 2,
        maximum: 2,
        pattern: /^[A-Za-z]{2}$/,
        transform: (value) => value.toUpperCase(),
      }),
      readRequiredText({
        field: "specialty",
        label: "Especialidade",
        minimum: 2,
        maximum: 120,
      }),
      addNullableText({
        field: "phone",
        label: "Telefone",
        maximum: 20,
      }),
      addNullableText({
        field: "email",
        label: "E-mail",
        maximum: 254,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        transform: (value) => value.toLowerCase(),
      }),
      addNullableText({
        field: "userId",
        label: "Conta de usuário",
        maximum: 36,
        pattern: /^[0-9a-f-]{36}$/i,
      }),
    );

    if (
      typeof payload.userId === "string" &&
      !isUuid(payload.userId)
    ) {
      errors.push("Conta de usuário inválida");
    }
  }

  errors.push(
    addNullableText({
      field: "localCode",
      label: "Código local",
      maximum: 60,
    }),
  );

  if (
    mode === "create" ||
    "defaultAppointmentDurationMinutes" in
      professionalBody
  ) {
    const duration =
      professionalBody
        .defaultAppointmentDurationMinutes;

    if (
      typeof duration !== "number" ||
      !Number.isInteger(duration) ||
      duration < 5 ||
      duration > 480
    ) {
      errors.push(
        "A duração padrão deve ser um número inteiro entre 5 e 480 minutos",
      );
    } else {
      payload.defaultAppointmentDurationMinutes =
        duration;
    }
  }

  if (
    mode === "create" ||
    "acceptsAppointments" in professionalBody
  ) {
    const acceptsAppointments =
      professionalBody.acceptsAppointments;

    if (typeof acceptsAppointments !== "boolean") {
      errors.push(
        "A informação sobre aceitar agendamentos é inválida",
      );
    } else {
      payload.acceptsAppointments =
        acceptsAppointments;
    }
  }

  const error = errors.find(
    (item): item is string => item !== null,
  );

  if (error) {
    return {
      ok: false,
      status: 422,
      message: error,
    };
  }

  if (
    mode === "update" &&
    Object.keys(payload).length === 0
  ) {
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