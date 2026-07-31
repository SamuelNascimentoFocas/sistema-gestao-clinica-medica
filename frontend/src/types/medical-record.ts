import type {
  AppointmentStatus,
} from "@/types/appointment";
import type {
  MedicalRecordSummary,
  PaginationMeta,
  Patient,
} from "@/types/patient";

export type MedicalRecordAccessPurpose =
  | "patient_care"
  | "care_coordination"
  | "legal_obligation"
  | "other";

export type MedicalRecordEntryType =
  | "consultation"
  | "evolution"
  | "correction"
  | "other";

export type MedicalRecordAttachmentStatus =
  | "pending"
  | "available"
  | "rejected";

export type MedicalRecordPatientLinkSummary = {
  id: string;
  clinicId: string;
  localRecordNumber: string | null;
  isActive: boolean;
};

export type MedicalRecordClinicSummary = {
  id: string;
  name: string;
  timezone?: string;
  isActive?: boolean;
};

export type MedicalRecordProfessionalSummary = {
  id: string;
  userId: string | null;
  fullName: string;
  crmNumber: string;
  crmState: string;
  specialty: string;
  isActive: boolean;
};

export type MedicalRecordClinicProfessionalSummary = {
  id: string;
  clinicId: string;
  professionalId: string;
  localCode: string | null;
  defaultAppointmentDurationMinutes: number;
  acceptsAppointments: boolean;
  isActive: boolean;
  professional: MedicalRecordProfessionalSummary;
};

export type MedicalRecordUserSummary = {
  id: string;
  fullName: string;
  email: string;
};

export type MedicalRecordAppointmentSummary = {
  id: string;
  clinicId: string;
  patientClinicId: string;
  clinicProfessionalId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  appointmentTypeCode: string | null;
};

export type MedicalRecordEntryBase = {
  id: string;
  medicalRecordId: string;
  patientId: string;
  clinicId: string;
  patientClinicId: string;
  clinicProfessionalId: string;
  appointmentId: string | null;
  authorUserId: string;
  entryTypeCode: MedicalRecordEntryType;
  content: string;
  correctsEntryId: string | null;
  createdAt: string;
};

export type MedicalRecordRelatedEntry =
  MedicalRecordEntryBase & {
    clinic?: MedicalRecordClinicSummary | null;
    clinicProfessional?:
      | MedicalRecordClinicProfessionalSummary
      | null;
    appointment?:
      | MedicalRecordAppointmentSummary
      | null;
    authorUser?: MedicalRecordUserSummary | null;
  };

export type MedicalRecordEntry =
  MedicalRecordRelatedEntry & {
    correctedEntry?:
      | MedicalRecordRelatedEntry
      | null;
    corrections: MedicalRecordRelatedEntry[];
  };

export type MedicalRecordTimelineResponse = {
  medicalRecord: MedicalRecordSummary;
  patient: Patient;
  patientLink: MedicalRecordPatientLinkSummary;
  entries: MedicalRecordEntry[];
  meta: PaginationMeta;
};

export type MedicalRecordEntryResponse = {
  entry: MedicalRecordEntry;
};

export type MedicalRecordAttachment = {
  id: string;
  medicalRecordEntryId: string;
  medicalRecordId: string;
  patientId: string;
  clinicId: string;
  uploadedByUserId: string;
  originalName: string;
  contentType: string;
  sizeInBytes: number;
  status: MedicalRecordAttachmentStatus;
  statusReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MedicalRecordAttachmentsResponse = {
  attachments: MedicalRecordAttachment[];
  meta: PaginationMeta;
};

export type MedicalRecordAttachmentUploadResponse = {
  attachments: MedicalRecordAttachment[];
};

export type MedicalRecordAccessValues = {
  purposeCode: MedicalRecordAccessPurpose;
  purposeNote: string;
};

export const MEDICAL_RECORD_ACCESS_PURPOSE_OPTIONS = [
  {
    value: "patient_care",
    label: "Cuidado direto ao paciente",
    description:
      "Consulta, avaliação ou acompanhamento do paciente.",
  },
  {
    value: "care_coordination",
    label: "Coordenação do cuidado",
    description:
      "Integração de informações entre profissionais ou serviços.",
  },
  {
    value: "legal_obligation",
    label: "Obrigação legal",
    description:
      "Acesso necessário para cumprir uma obrigação legal aplicável.",
  },
  {
    value: "other",
    label: "Outra finalidade",
    description:
      "Finalidade específica que deverá ser detalhada.",
  },
] as const satisfies readonly {
  value: MedicalRecordAccessPurpose;
  label: string;
  description: string;
}[];

export const MEDICAL_RECORD_ENTRY_TYPE_OPTIONS = [
  {
    value: "consultation",
    label: "Consulta",
  },
  {
    value: "evolution",
    label: "Evolução",
  },
  {
    value: "other",
    label: "Outro registro clínico",
  },
] as const satisfies readonly {
  value: Exclude<
    MedicalRecordEntryType,
    "correction"
  >;
  label: string;
}[];

export function getMedicalRecordPurposeLabel(
  purpose: MedicalRecordAccessPurpose,
) {
  return (
    MEDICAL_RECORD_ACCESS_PURPOSE_OPTIONS.find(
      (option) => option.value === purpose,
    )?.label ?? purpose
  );
}

export function getMedicalRecordEntryTypeLabel(
  entryType: MedicalRecordEntryType,
) {
  if (entryType === "correction") {
    return "Correção";
  }

  return (
    MEDICAL_RECORD_ENTRY_TYPE_OPTIONS.find(
      (option) => option.value === entryType,
    )?.label ?? entryType
  );
}