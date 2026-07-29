import type {
  ClinicProfessionalLink,
  ProfessionalScheduleBlock,
  ProfessionalWeeklyAvailability,
} from "@/types/professional";

export type ProfessionalSchedule =
  ClinicProfessionalLink & {
    weeklyAvailabilities: ProfessionalWeeklyAvailability[];
    scheduleBlocks: ProfessionalScheduleBlock[];
  };

export type ProfessionalScheduleResponse = {
  schedule: ProfessionalSchedule;
};

export type WeeklyAvailabilityResponse = {
  availability: ProfessionalWeeklyAvailability;
};

export type ScheduleBlockResponse = {
  scheduleBlock: ProfessionalScheduleBlock;
};

export type WeeklyAvailabilityFormValues = {
  weekday: string;
  startTime: string;
  endTime: string;
};

export type ScheduleBlockFormValues = {
  startsAt: string;
  endsAt: string;
  reason: string;
};

export const EMPTY_WEEKLY_AVAILABILITY_FORM: WeeklyAvailabilityFormValues = {
  weekday: "1",
  startTime: "08:00",
  endTime: "12:00",
};

export const EMPTY_SCHEDULE_BLOCK_FORM: ScheduleBlockFormValues = {
  startsAt: "",
  endsAt: "",
  reason: "",
};

export const WEEKDAYS = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
] as const;

export function getWeekdayLabel(weekday: number) {
  return (
    WEEKDAYS.find((item) => item.value === weekday)?.label ??
    `Dia ${weekday}`
  );
}

export function normalizeTimeForInput(value: string) {
  return value.slice(0, 5);
}

export function weeklyAvailabilityToForm(
  availability: ProfessionalWeeklyAvailability,
): WeeklyAvailabilityFormValues {
  return {
    weekday: String(availability.weekday),
    startTime: normalizeTimeForInput(availability.startTime),
    endTime: normalizeTimeForInput(availability.endTime),
  };
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMilliseconds = date.getTimezoneOffset() * 60_000;
  const localDate = new Date(date.getTime() - offsetMilliseconds);

  return localDate.toISOString().slice(0, 16);
}

export function scheduleBlockToForm(
  scheduleBlock: ProfessionalScheduleBlock,
): ScheduleBlockFormValues {
  return {
    startsAt: toDateTimeLocalValue(scheduleBlock.startsAt),
    endsAt: toDateTimeLocalValue(scheduleBlock.endsAt),
    reason: scheduleBlock.reason ?? "",
  };
}