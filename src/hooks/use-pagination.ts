"use client";

import { useState, useMemo, useCallback } from "react";

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  offset: number;
}

export function usePagination(initialPage = 1, initialLimit = 20) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const offset = useMemo(() => (page - 1) * limit, [page, limit]);

  const goTo = useCallback((p: number) => setPage(Math.max(1, Math.min(p, totalPages))), [totalPages]);
  const next = useCallback(() => goTo(page + 1), [goTo, page]);
  const prev = useCallback(() => goTo(page - 1), [goTo, page]);
  const first = useCallback(() => setPage(1), []);
  const last = useCallback(() => setPage(totalPages), [totalPages]);
  const changeLimit = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  return {
    page,
    limit,
    total,
    totalPages,
    offset,
    setPage: goTo,
    setTotal,
    next,
    prev,
    first,
    last,
    changeLimit,
  } satisfies PaginationState & {
    setPage: (p: number) => void;
    setTotal: (t: number) => void;
    next: () => void;
    prev: () => void;
    first: () => void;
    last: () => void;
    changeLimit: (l: number) => void;
  };
}
