import type { PaginationMeta } from "@/types/patient";

export type AuditLogAccessAction =
  | "view_timeline"
  | "view_entry"
  | "list_attachments"
  | "download_attachment";

export type AuditLogPurposeCode =
  | "patient_care"
  | "care_coordination"
  | "legal_obligation"
  | "other";

export type AuditLogUserSummary = {
  id: string;
  fullName: string;
};

export type AuditLogPatientSummary = {
  id: string;
  fullName: string;
};

export type AuditLogAttachmentSummary = {
  id: string;
  originalName: string;
  contentType: string;
  sizeInBytes: number;
};

export type AuditLog = {
  id: string;
  medicalRecordId: string;
  patientClinicId: string;
  accessAction: AuditLogAccessAction;
  purposeCode: AuditLogPurposeCode;
  purposeNote: string | null;
  accessedAt: string;
  user: AuditLogUserSummary;
  patient: AuditLogPatientSummary;
  attachment: AuditLogAttachmentSummary | null;
};

export type AuditLogsResponse = {
  data: AuditLog[];
  meta: PaginationMeta;
};

export const AUDIT_LOG_ACTION_OPTIONS = [
  {
    value: "view_timeline",
    label: "Visualização da linha do tempo",
  },
  {
    value: "view_entry",
    label: "Visualização de registro clínico",
  },
  {
    value: "list_attachments",
    label: "Listagem de anexos",
  },
  {
    value: "download_attachment",
    label: "Download de anexo",
  },
] as const satisfies ReadonlyArray<{
  value: AuditLogAccessAction;
  label: string;
}>;

export const AUDIT_LOG_PURPOSE_OPTIONS = [
  {
    value: "patient_care",
    label: "Cuidado do paciente",
  },
  {
    value: "care_coordination",
    label: "Coordenação do cuidado",
  },
  {
    value: "legal_obligation",
    label: "Obrigação legal",
  },
  {
    value: "other",
    label: "Outra finalidade",
  },
] as const satisfies ReadonlyArray<{
  value: AuditLogPurposeCode;
  label: string;
}>;

export function getAuditLogActionLabel(
  action: AuditLogAccessAction,
) {
  return (
    AUDIT_LOG_ACTION_OPTIONS.find(
      (option) => option.value === action,
    )?.label ?? action
  );
}

export function getAuditLogPurposeLabel(
  purposeCode: AuditLogPurposeCode,
) {
  return (
    AUDIT_LOG_PURPOSE_OPTIONS.find(
      (option) => option.value === purposeCode,
    )?.label ?? purposeCode
  );
}