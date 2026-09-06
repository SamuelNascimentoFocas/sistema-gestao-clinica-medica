import type {
  PaginatedResponse,
  PaginationMeta,
} from "@/types/pagination";

export type RemoteQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type RemoteQuery = Readonly<Record<string, RemoteQueryValue>>;

export function buildRemoteDataTableUrl(
  route: string,
  query: RemoteQuery,
  page: number,
  perPage: number,
) {
  if (!route.startsWith("/api/")) {
    throw new TypeError("RemoteDataTable requires a relative BFF route");
  }

  const searchParams = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
  });

  for (const key of Object.keys(query).sort()) {
    const value = query[key];

    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }

  return `${route}?${searchParams.toString()}`;
}

function isPaginationMeta(value: unknown): value is PaginationMeta {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const meta = value as Record<string, unknown>;

  return (
    typeof meta.total === "number" &&
    Number.isInteger(meta.total) &&
    meta.total >= 0 &&
    typeof meta.perPage === "number" &&
    Number.isInteger(meta.perPage) &&
    meta.perPage >= 1 &&
    typeof meta.currentPage === "number" &&
    Number.isInteger(meta.currentPage) &&
    meta.currentPage >= 1 &&
    typeof meta.lastPage === "number" &&
    Number.isInteger(meta.lastPage) &&
    meta.lastPage >= 0
  );
}

export function parseRemoteDataTableResponse<TData>(
  value: unknown,
): PaginatedResponse<TData> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const response = value as {
    data?: unknown;
    meta?: unknown;
  };

  if (!Array.isArray(response.data) || !isPaginationMeta(response.meta)) {
    return null;
  }

  return {
    data: response.data as TData[],
    meta: response.meta,
  };
}
