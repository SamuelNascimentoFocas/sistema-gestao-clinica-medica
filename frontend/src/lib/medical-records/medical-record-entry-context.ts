import type { AppointmentStatus } from "@/types/appointment";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readOptionalUuidSearchParam(
  value: string | string[] | undefined,
) {
  return typeof value === "string" && UUID_PATTERN.test(value)
    ? value
    : null;
}

export function getCompletedAppointmentMedicalRecordHref({
  clinicId,
  patientId,
  appointmentId,
  appointmentStatus,
  canCreateMedicalRecordEntries,
}: {
  clinicId: string;
  patientId: string;
  appointmentId: string;
  appointmentStatus: AppointmentStatus;
  canCreateMedicalRecordEntries: boolean;
}) {
  if (
    appointmentStatus !== "completed" ||
    !canCreateMedicalRecordEntries
  ) {
    return null;
  }

  const searchParams = new URLSearchParams({
    patientId,
    appointmentId,
  });

  return `/clinics/${encodeURIComponent(
    clinicId,
  )}/medical-records?${searchParams.toString()}`;
}
