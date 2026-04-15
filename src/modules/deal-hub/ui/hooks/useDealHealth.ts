"use client";

import { useQuery } from "@tanstack/react-query";
import type { DealHealthEvaluation } from "../../domain/deal-health.types";
import { parseResponseJson } from "@/lib/api/parse-response-json";

export function useDealHealth(dealId: string) {
  return useQuery({
    queryKey: ["deal-hub", "health", dealId],
    queryFn: async () => {
      const response = await fetch(`/api/deals/${dealId}/health`, { cache: "no-store" });
      const json = await parseResponseJson<{ data?: DealHealthEvaluation }>(response);
      return json.data ?? null;
    },
  });
}
