import {
  getAuditLogActionLabel,
  getAuditLogPurposeLabel,
  type AuditLog,
  type AuditLogAccessAction,
} from "@/types/audit-log";

type AuditLogListItemProps = {
  log: AuditLog;
  clinicTimezone: string;
};

function formatDateTime(
  value: string,
  timeZone: string,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return value;
  }
}

function formatFileSize(sizeInBytes: number) {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} bytes`;
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${(
      sizeInBytes / 1024
    ).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} KB`;
  }

  return `${(
    sizeInBytes /
    (1024 * 1024)
  ).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })} MB`;
}

function getActionClass(
  action: AuditLogAccessAction,
) {
  switch (action) {
    case "view_timeline":
      return "bg-blue-100 text-blue-800";

    case "view_entry":
      return "bg-violet-100 text-violet-800";

    case "list_attachments":
      return "bg-amber-100 text-amber-800";

    case "download_attachment":
      return "bg-emerald-100 text-emerald-800";
  }
}

export function AuditLogListItem({
  log,
  clinicTimezone,
}: AuditLogListItemProps) {
  return (
    <article className="rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold">
            {log.user.fullName}
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateTime(
              log.accessedAt,
              clinicTimezone,
            )}
          </p>
        </div>

        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${getActionClass(
            log.accessAction,
          )}`}
        >
          {getAuditLogActionLabel(
            log.accessAction,
          )}
        </span>
      </div>

      <dl className="mt-4 grid gap-4 border-t pt-4 text-sm md:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">
            Usuário responsável
          </dt>

          <dd className="font-medium">
            {log.user.fullName}
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground">
            Paciente acessado
          </dt>

          <dd className="font-medium">
            {log.patient.fullName}
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground">
            Finalidade declarada
          </dt>

          <dd className="font-medium">
            {getAuditLogPurposeLabel(
              log.purposeCode,
            )}
          </dd>
        </div>
      </dl>

      {log.purposeNote ? (
        <div className="mt-4 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Observação da finalidade
          </p>

          <p className="mt-1 text-sm">
            {log.purposeNote}
          </p>
        </div>
      ) : null}

      <div className="mt-4 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          Identificador do prontuário
        </p>

        <p className="mt-1 break-all font-mono text-xs">
          {log.medicalRecordId}
        </p>
      </div>

      {log.attachment ? (
        <div className="mt-4 rounded-md border bg-muted/30 p-3">
          <p className="text-sm font-medium">
            Anexo relacionado
          </p>

          <p className="mt-1 break-all text-sm">
            {log.attachment.originalName}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {log.attachment.contentType} ·{" "}
            {formatFileSize(
              log.attachment.sizeInBytes,
            )}
          </p>
        </div>
      ) : null}
    </article>
  );
}