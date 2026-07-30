type DateParts = {
  year: number;
  month: number;
  day: number;
};

function parseDateInput(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}

export function isValidDateInput(value: string) {
  return parseDateInput(value) !== null;
}

export function formatDateInputInTimeZone(
  date: Date,
  timeZone: string,
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function addDaysToDateInput(
  value: string,
  days: number,
) {
  const parts = parseDateInput(value);

  if (!parts) {
    throw new Error("Data inválida");
  }

  const date = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day + days,
    ),
  );

  return date.toISOString().slice(0, 10);
}

export function differenceInDateInputs(
  from: string,
  to: string,
) {
  const fromParts = parseDateInput(from);
  const toParts = parseDateInput(to);

  if (!fromParts || !toParts) {
    throw new Error("Data inválida");
  }

  const fromMilliseconds = Date.UTC(
    fromParts.year,
    fromParts.month - 1,
    fromParts.day,
  );

  const toMilliseconds = Date.UTC(
    toParts.year,
    toParts.month - 1,
    toParts.day,
  );

  return Math.round(
    (toMilliseconds - fromMilliseconds) /
      86_400_000,
  );
}

function getTimeZoneOffsetMilliseconds(
  date: Date,
  timeZone: string,
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  const dateInTimeZoneAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return dateInTimeZoneAsUtc - date.getTime();
}

export function localDateStartToUtcIso(
  value: string,
  timeZone: string,
) {
  const parts = parseDateInput(value);

  if (!parts) {
    throw new Error("Data inválida");
  }

  const localWallTimeAsUtc = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      0,
      0,
      0,
    ),
  );

  const firstOffset = getTimeZoneOffsetMilliseconds(
    localWallTimeAsUtc,
    timeZone,
  );

  let utcDate = new Date(
    localWallTimeAsUtc.getTime() - firstOffset,
  );

  const correctedOffset =
    getTimeZoneOffsetMilliseconds(utcDate, timeZone);

  if (correctedOffset !== firstOffset) {
    utcDate = new Date(
      localWallTimeAsUtc.getTime() -
        correctedOffset,
    );
  }

  return utcDate.toISOString();
}

function parseDateTimeLocalInput(value: string) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(
      value,
    );

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
    ),
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
  };
}

export function formatDateTimeLocalInputInTimeZone(
  value: string,
  timeZone: string,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const getPart = (type: string) =>
      parts.find((part) => part.type === type)
        ?.value ?? "";

    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const hour = getPart("hour");
    const minute = getPart("minute");

    if (
      !year ||
      !month ||
      !day ||
      !hour ||
      !minute
    ) {
      return "";
    }

    return `${year}-${month}-${day}T${hour}:${minute}`;
  } catch {
    return "";
  }
}

export function localDateTimeToUtcIso(
  value: string,
  timeZone: string,
) {
  const parts = parseDateTimeLocalInput(value);

  if (!parts) {
    throw new Error("Data e hora inválidas");
  }

  const localWallTimeAsUtc = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0,
    ),
  );

  const firstOffset = getTimeZoneOffsetMilliseconds(
    localWallTimeAsUtc,
    timeZone,
  );

  let utcDate = new Date(
    localWallTimeAsUtc.getTime() - firstOffset,
  );

  const correctedOffset =
    getTimeZoneOffsetMilliseconds(utcDate, timeZone);

  if (correctedOffset !== firstOffset) {
    utcDate = new Date(
      localWallTimeAsUtc.getTime() -
        correctedOffset,
    );
  }

  return utcDate.toISOString();
}

export function formatAppointmentDateTime(
  value: string,
  timeZone: string,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}