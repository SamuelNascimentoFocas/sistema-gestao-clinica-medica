"use client";

import { useState } from "react";

import { PatientForm } from "@/components/patients/patient-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PatientClinicLink } from "@/types/patient";

type CreatePatientCardProps = {
  clinicId: string;
  onCreated: (patientLink: PatientClinicLink) => void;
};

export function CreatePatientCard({
  clinicId,
  onCreated,
}: CreatePatientCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) {
    return (
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Cadastro de pacientes</CardTitle>

            <CardDescription>
              Cadastre um novo paciente ou vincule à clínica um paciente global
              já existente.
            </CardDescription>
          </div>

          <Button
            type="button"
            onClick={() => {
              setSuccessMessage(null);
              setIsOpen(true);
            }}
          >
            Novo paciente
          </Button>
        </CardHeader>

        {successMessage ? (
          <CardContent>
            <p className="text-sm font-medium text-emerald-700" role="status">
              {successMessage}
            </p>
          </CardContent>
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo paciente</CardTitle>

        <CardDescription>
          Nome completo e data de nascimento são obrigatórios. Os demais campos
          podem ser preenchidos conforme a disponibilidade.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <PatientForm
          clinicId={clinicId}
          onSuccess={(patientLink) => {
            onCreated(patientLink);
            setIsOpen(false);
            setSuccessMessage("Paciente cadastrado e vinculado à clínica.");
          }}
          onCancel={() => setIsOpen(false)}
        />
      </CardContent>
    </Card>
  );
}
