"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import type { SupplierItem, SupplierSearchResult } from "../core/supplierTypes";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState<T>(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type UseSupplierSearchArgs = {
  query: string;
  limit?: number;
  enabled?: boolean;
};

export function useSupplierSearch({
  query,
  limit = 20,
  enabled = true,
}: UseSupplierSearchArgs) {
  const debounced = useDebouncedValue(query, 180);
  const canSearch = enabled && debounced.trim().length >= 2;
  const key = useMemo(() => ["supplier-search", debounced, limit], [debounced, limit]);
  const q = useQuery<SupplierSearchResult>({
    queryKey: key,
    enabled: canSearch,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await fetch(
        `/api/suppliers/search?q=${encodeURIComponent(debounced)}&limit=${limit}`,
      );
      if (!r.ok) throw new Error("Supplier search failed");
      return (await r.json()) as SupplierSearchResult;
    },
  });
  return {
    data: q.data,
    error: q.error,
    isError: q.isError,
    isFetching: q.isFetching,
    isLoading: q.isLoading,
    isSuccess: q.isSuccess,
    isPending: q.isPending,
    refetch: q.refetch,
    status: q.status,
    items: q.data?.items ?? ([] as SupplierItem[]),
    searchQuery: debounced,
  };
}
