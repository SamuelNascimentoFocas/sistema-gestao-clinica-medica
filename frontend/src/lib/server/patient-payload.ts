import "server-only";

type PatientPayloadMode = "create" | "update";

type PatientPayloadResult =
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

function isValidDateOnly(value: string) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function parsePatientPayload(
  body: unknown,
  mode: PatientPayloadMode,
): PatientPayloadResult {
  if (!isObject(body)) {
    return {
      ok: false,
      status: 400,
      message: "Corpo da requisição inválido",
    };
  }

  const patientBody = body;

  const payload: Record<string, unknown> = {};

  if (mode === "create" || "fullName" in body) {
    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.trim()
        : "";

    if (fullName.length < 3 || fullName.length > 180) {
      return {
        ok: false,
        status: 422,
        message:
          "O nome deve possuir entre 3 e 180 caracteres",
      };
    }

    payload.fullName = fullName;
  }

  if (mode === "create" || "birthDate" in body) {
    const birthDate =
      typeof body.birthDate === "string"
        ? body.birthDate
        : "";

    if (!isValidDateOnly(birthDate)) {
      return {
        ok: false,
        status: 422,
        message:
          "Informe uma data de nascimento válida",
      };
    }

    payload.birthDate = birthDate;
  }

  function addNullableText({
    field,
    label,
    maxLength,
    pattern,
    transform,
  }: {
    field: string;
    label: string;
    maxLength: number;
    pattern?: RegExp;
    transform?: (value: string) => string;
  }): string | null {
    if (!(field in patientBody)) {
      return null;
    }

    const rawValue = patientBody[field];

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

    if (value.length > maxLength) {
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

  const fieldErrors = [
    addNullableText({
      field: "cpf",
      label: "CPF",
      maxLength: 11,
      pattern: /^[0-9]{11}$/,
    }),
    addNullableText({
      field: "phone",
      label: "Telefone",
      maxLength: 20,
    }),
    addNullableText({
      field: "email",
      label: "E-mail",
      maxLength: 254,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      transform: (value) => value.toLowerCase(),
    }),
    addNullableText({
      field: "addressStreet",
      label: "Logradouro",
      maxLength: 180,
    }),
    addNullableText({
      field: "addressNumber",
      label: "Número",
      maxLength: 30,
    }),
    addNullableText({
      field: "addressComplement",
      label: "Complemento",
      maxLength: 120,
    }),
    addNullableText({
      field: "addressNeighborhood",
      label: "Bairro",
      maxLength: 120,
    }),
    addNullableText({
      field: "addressCity",
      label: "Cidade",
      maxLength: 120,
    }),
    addNullableText({
      field: "addressState",
      label: "Estado",
      maxLength: 2,
      pattern: /^[A-Za-z]{2}$/,
      transform: (value) => value.toUpperCase(),
    }),
    addNullableText({
      field: "addressPostalCode",
      label: "CEP",
      maxLength: 8,
      pattern: /^[0-9]{8}$/,
    }),
    addNullableText({
      field: "localRecordNumber",
      label: "Número do prontuário local",
      maxLength: 60,
    }),
  ];

  const fieldError = fieldErrors.find(
    (error): error is string => error !== null,
  );

  if (fieldError) {
    return {
      ok: false,
      status: 422,
      message: fieldError,
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