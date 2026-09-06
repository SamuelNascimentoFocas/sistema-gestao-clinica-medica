"use client";

import { PatientForm } from "@/components/patients/patient-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PatientClinicLink } from "@/types/patient";

type EditPatientCardProps = {
  clinicId: string;
  patientLink: PatientClinicLink;
  onUpdated: (patientLink: PatientClinicLink) => void;
  onCancel: () => void;
};

export function EditPatientCard({
  clinicId,
  patientLink,
  onUpdated,
  onCancel,
}: EditPatientCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar {patientLink.patient.fullName}</CardTitle>

        <CardDescription>
          Atualize os dados do paciente e as informações específicas do vínculo
          com esta clínica.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <PatientForm
          key={patientLink.id}
          clinicId={clinicId}
          patientLink={patientLink}
          onSuccess={onUpdated}
          onCancel={onCancel}
        />
      </CardContent>
    </Card>
  );
}
