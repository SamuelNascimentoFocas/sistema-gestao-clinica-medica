import { notFound } from "next/navigation";
import { MedicalRecordsManager } from "@/components/medical-records/medical-records-manager";
import { requireClinicPermissions } from "@/lib/server/clinic-authorization";
import { getClinicPatients } from "@/lib/server/clinic-patients";
import { hasAnyPermission } from "@/lib/auth/permissions";

type PageProps = {
  params: Promise<{
    clinicId: string;
  }>;
};

export const metadata = {
  title: "Prontuários",
};

export default async function MedicalRecordsPage({
  params,
}: PageProps) {
  const { clinicId } = await params;

  const context = await requireClinicPermissions(
    clinicId,
    ["medical_records.read"],
  );

const canCreateEntries = hasAnyPermission(
  context.access.permissions,
  ["medical_records.create"],
);

const canCorrectEntries = hasAnyPermission(
  context.access.permissions,
  ["medical_records.correct"],
);

const canReadAttachments = hasAnyPermission(
  context.access.permissions,
  ["attachments.read"],
);

const canUploadAttachments = hasAnyPermission(
  context.access.permissions,
  ["attachments.upload"],
);

  const patientsResponse = await getClinicPatients(
    clinicId,
    {
      page: 1,
      perPage: 100,
    },
  );

  if (!patientsResponse) {
    notFound();
  }

  const availablePatients =
    patientsResponse.data.filter(
      (patientLink) =>
        patientLink.isActive &&
        patientLink.patient.isActive &&
        patientLink.patient.medicalRecord !== null,
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Prontuários
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Consulte a linha do tempo clínica dos
          pacientes mediante registro da finalidade
          do acesso.
        </p>
      </div>

      <MedicalRecordsManager
        clinicId={clinicId}
        clinicTimezone={context.clinic.timezone}
        patients={availablePatients}
        canCreateEntries={canCreateEntries}
        canCorrectEntries={canCorrectEntries}
        canReadAttachments={canReadAttachments}
        canUploadAttachments={canUploadAttachments}
      />
    </div>
  );
}
