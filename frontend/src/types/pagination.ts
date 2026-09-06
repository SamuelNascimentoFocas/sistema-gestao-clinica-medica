export type PaginationMeta = {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
};

export type PaginatedResponse<TData> = {
  data: TData[];
  meta: PaginationMeta;
};
