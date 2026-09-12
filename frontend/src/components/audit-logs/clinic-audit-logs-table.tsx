"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  RemoteDataTable,
  type RemoteDataTableColumn,
} from "@/components/data-table/remote-data-table";
import {
  getAuditLogActionLabel,
  getAuditLogPurposeLabel,
  type AuditLog,
  type AuditLogAccessAction,
  type AuditLogPurposeCode,
} from "@/types/audit-log";

type ClinicAuditLogsTableProps = {
  clinicId: string;
  clinicTimezone: string;
  page: number;
  query: {
    from: string;
    to: string;
    userId?: string;
    patientId?: string;
    accessAction?: AuditLogAccessAction;
    purposeCode?: AuditLogPurposeCode;
  };
};

function formatDateTime(value: string, timeZone: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

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
  if (sizeInBytes < 1024) return `${sizeInBytes} bytes`;

  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} KB`;
  }

  return `${(sizeInBytes / (1024 * 1024)).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })} MB`;
}

export function ClinicAuditLogsTable({
  clinicId,
  clinicTimezone,
  page,
  query,
}: ClinicAuditLogsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set("page", String(nextPage));
      router.push(`${pathname}?${nextSearchParams.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const columns: RemoteDataTableColumn<AuditLog>[] = [
    {
      id: "accessedAt",
      header: "Data e horário",
      cell: (log) => (
        <span className="whitespace-nowrap">
          {formatDateTime(log.accessedAt, clinicTimezone)}
        </span>
      ),
    },
    {
      id: "user",
      header: "Usuário",
      cell: (log) => <span className="font-medium">{log.user.fullName}</span>,
    },
    {
      id: "patient",
      header: "Paciente",
      cell: (log) => (
        <div className="min-w-40">
          <p className="font-medium">{log.patient.fullName}</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {log.medicalRecordId}
          </p>
        </div>
      ),
    },
    {
      id: "action",
      header: "Ação",
      cell: (log) => getAuditLogActionLabel(log.accessAction),
    },
    {
      id: "purpose",
      header: "Finalidade",
      cell: (log) => (
        <div className="min-w-40">
          <p>{getAuditLogPurposeLabel(log.purposeCode)}</p>
          {log.purposeNote ? (
            <p className="mt-1 text-xs text-muted-foreground">{log.purposeNote}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "attachment",
      header: "Anexo",
      cell: (log) =>
        log.attachment ? (
          <div className="min-w-40">
            <p className="break-all">{log.attachment.originalName}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {log.attachment.contentType} · {formatFileSize(log.attachment.sizeInBytes)}
            </p>
          </div>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <RemoteDataTable
      route={`/api/clinics/${encodeURIComponent(clinicId)}/audit-logs`}
      columns={columns}
      query={query}
      page={page}
      getRowId={(log) => log.id}
      onPageChange={handlePageChange}
      summary={(meta) =>
        meta.total === 1
          ? "1 evento de auditoria encontrado."
          : `${meta.total} eventos de auditoria encontrados.`
      }
      emptyTitle="Nenhum evento encontrado"
      emptyDescription="Ajuste o período ou os filtros para consultar outros registros."
    />
  );
}
