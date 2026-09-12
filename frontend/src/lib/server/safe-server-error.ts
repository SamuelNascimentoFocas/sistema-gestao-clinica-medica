const ERROR_NAME_PATTERN = /^(?:Error|[A-Za-z][A-Za-z0-9]*Error)$/;
const TECHNICAL_CODE_PATTERN = /^[A-Z][A-Z0-9_.:-]{0,63}$/;

export type SafeServerErrorLog = Readonly<{
  event: string;
  errorName?: string;
  errorCode?: string;
  causeCode?: string;
}>;

type SafeServerErrorWriter = (entry: SafeServerErrorLog) => void;

function readProperty(value: unknown, property: string): unknown {
  if ((typeof value !== "object" || value === null) && typeof value !== "function") {
    return undefined;
  }

  try {
    return Reflect.get(value, property);
  } catch {
    return undefined;
  }
}

function normalizeErrorName(value: unknown): string | undefined {
  return typeof value === "string" && ERROR_NAME_PATTERN.test(value)
    ? value
    : undefined;
}

function normalizeTechnicalCode(value: unknown): string | undefined {
  return typeof value === "string" && TECHNICAL_CODE_PATTERN.test(value)
    ? value
    : undefined;
}

export function createSafeServerErrorLog(
  event: string,
  error: unknown,
): SafeServerErrorLog {
  const errorName = normalizeErrorName(readProperty(error, "name"));
  const errorCode = normalizeTechnicalCode(readProperty(error, "code"));
  const cause = readProperty(error, "cause");
  const causeCode = normalizeTechnicalCode(readProperty(cause, "code"));

  return {
    event,
    ...(errorName ? { errorName } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(causeCode ? { causeCode } : {}),
  };
}

export function emitSafeServerError(
  event: string,
  error: unknown,
  write: SafeServerErrorWriter,
): void {
  try {
    write(createSafeServerErrorLog(event, error));
  } catch {
    // Logging must never replace the original application error path.
  }
}
