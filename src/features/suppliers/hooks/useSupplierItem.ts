"use client";

import { useQuery } from "@tanstack/react-query";
import type { SupplierItem } from "../core/supplierTypes";

export function useSupplierItem(id: string | null | undefined) {
  return useQuery<SupplierItem | null>({
    queryKey: ["supplier-item", id ?? ""],
    enabled: Boolean(id),
    staleTime: 60_000,
    queryFn: async () => {
      const r = await fetch(`/api/suppliers/items/${id}`);
      if (!r.ok) throw new Error("Cannot load supplier item");
      const j = (await r.json()) as { item: SupplierItem | null };
      return j.item;
    },
  });
}
