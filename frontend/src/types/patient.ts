import type { PaginationMeta } from "@/types/pagination";

export type MedicalRecordSummary = {
  id: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
};

export type Patient = {
  id: string;
  fullName: string;
  birthDate: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  medicalRecord: MedicalRecordSummary | null;
};

export type PatientClinicLink = {
  id: string;
  patientId: string;
  clinicId: string;
  localRecordNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  patient: Patient;
};

export type PatientLinksResponse = {
  data: PatientClinicLink[];
  meta: PaginationMeta;
};

export type PatientLinkResponse = {
  patientLink: PatientClinicLink;
};

export type PatientStatusFilter =
  | "all"
  | "active"
  | "inactive";

export type PatientFormValues = {
  fullName: string;
  birthDate: string;
  cpf: string;
  phone: string;
  email: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  localRecordNumber: string;
};

export const EMPTY_PATIENT_FORM: PatientFormValues = {
  fullName: "",
  birthDate: "",
  cpf: "",
  phone: "",
  email: "",
  addressStreet: "",
  addressNumber: "",
  addressComplement: "",
  addressNeighborhood: "",
  addressCity: "",
  addressState: "",
  addressPostalCode: "",
  localRecordNumber: "",
};

export function patientLinkToForm(
  patientLink: PatientClinicLink,
): PatientFormValues {
  const { patient } = patientLink;

  return {
    fullName: patient.fullName,
    birthDate: patient.birthDate.slice(0, 10),
    cpf: patient.cpf ?? "",
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    addressStreet: patient.addressStreet ?? "",
    addressNumber: patient.addressNumber ?? "",
    addressComplement: patient.addressComplement ?? "",
    addressNeighborhood: patient.addressNeighborhood ?? "",
    addressCity: patient.addressCity ?? "",
    addressState: patient.addressState ?? "",
    addressPostalCode: patient.addressPostalCode ?? "",
    localRecordNumber:
      patientLink.localRecordNumber ?? "",
  };
}
