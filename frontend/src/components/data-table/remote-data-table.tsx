"use client";

import {
  createColumnHelper,
  tableFeatures,
  type RowData,
  useTable,
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  browserApi,
  isSuccessfulResponse,
  readBrowserJson,
  type BrowserResponse,
} from "@/lib/client/browser-api";
import {
  buildRemoteDataTableUrl,
  parseRemoteDataTableResponse,
  type RemoteQuery,
} from "@/lib/client/remote-data-table";
import type {
  PaginatedResponse,
  PaginationMeta,
} from "@/types/pagination";

const features = tableFeatures({});

export type RemoteDataTableColumn<TData extends RowData> = {
  id: string;
  header: string;
  cell: (row: TData) => ReactNode;
  className?: string;
};

type RemoteDataTableProps<TData extends RowData> = {
  route: string;
  columns: readonly RemoteDataTableColumn<TData>[];
  query?: RemoteQuery;
  page: number;
  perPage?: number;
  refreshKey?: number;
  getRowId: (row: TData) => string;
  onPageChange: (page: number) => void;
  summary: (meta: PaginationMeta) => ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  loadingLabel?: string;
  invalidResponseMessage?: string;
};

async function responseMessage(response: BrowserResponse) {
  const body = await readBrowserJson(response).catch(() => null);

  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return "Não foi possível carregar os dados";
}

export function RemoteDataTable<TData extends RowData>({
  route,
  columns,
  query = {},
  page,
  perPage = 20,
  refreshKey = 0,
  getRowId,
  onPageChange,
  summary,
  emptyTitle,
  emptyDescription,
  loadingLabel = "Carregando...",
  invalidResponseMessage = "O servidor retornou uma lista inválida",
}: RemoteDataTableProps<TData>) {
  const [response, setResponse] = useState<PaginatedResponse<TData> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  const requestUrl = buildRemoteDataTableUrl(route, query, page, perPage);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const request = await browserApi.request<string>({
          url: requestUrl,
          method: "GET",
          signal: controller.signal,
          fetchOptions: { cache: "no-store" },
        });

        if (request.status === 401) {
          window.location.assign("/login");
          return;
        }

        if (!isSuccessfulResponse(request)) {
          setErrorMessage(await responseMessage(request));
          return;
        }

        const body = await readBrowserJson(request);
        const parsed = parseRemoteDataTableResponse<TData>(body);

        if (!parsed) {
          setErrorMessage(invalidResponseMessage);
          return;
        }

        setResponse(parsed);

        if (parsed.meta.lastPage > 0 && page > parsed.meta.lastPage) {
          onPageChange(parsed.meta.lastPage);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível comunicar com o servidor",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [invalidResponseMessage, onPageChange, page, refreshKey, requestUrl, retryKey]);

  const tableColumns = useMemo(
    () => {
      const columnHelper = createColumnHelper<typeof features, TData>();

      return (
      columnHelper.columns(
        columns.map((column) =>
          columnHelper.accessor((row) => row, {
            id: column.id,
            header: column.header,
            cell: ({ row }) => column.cell(row.original),
          }),
        ),
      )
      );
    },
    [columns],
  );

  const data = response?.data ?? [];
  const table = useTable({
    features,
    columns: tableColumns,
    data,
    getRowId,
  });
  const meta = response?.meta;
  const hasInitialLoadError = errorMessage !== null && response === null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground" aria-live="polite">
          {meta ? summary(meta) : isLoading ? loadingLabel : null}
        </div>

        {isLoading && response ? (
          <span className="text-xs text-muted-foreground">Atualizando...</span>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-destructive/40 p-4" role="alert">
          <p className="text-sm text-destructive">{errorMessage}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => setRetryKey((current) => current + 1)}
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {!hasInitialLoadError ? (
        <div className="rounded-md border">
          <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const definition = columns.find(
                    (column) => column.id === header.column.id,
                  );

                  return (
                    <TableHead key={header.id} className={definition?.className}>
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading && !response ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-28 text-center">
                  {loadingLabel}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <p className="font-medium">{emptyTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {emptyDescription}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => {
                    const definition = columns.find(
                      (column) => column.id === cell.column.id,
                    );

                    return (
                      <TableCell key={cell.id} className={definition?.className}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
          </Table>
        </div>
      ) : null}

      {meta && meta.lastPage > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Página {meta.currentPage} de {meta.lastPage}
          </p>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading || meta.currentPage <= 1}
              onClick={() => onPageChange(meta.currentPage - 1)}
            >
              Anterior
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isLoading || meta.currentPage >= meta.lastPage}
              onClick={() => onPageChange(meta.currentPage + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
