"use client";

import { useQuery } from "@tanstack/react-query";
import type { DealHubOverview } from "../../domain/deal.types";
import { parseResponseJson } from "@/lib/api/parse-response-json";

export function useDealHub(dealId: string, initialData?: DealHubOverview | null) {
  return useQuery({
    queryKey: ["deal-hub", "overview", dealId],
    queryFn: async () => {
      const response = await fetch(`/api/deals/${dealId}/overview`, {
        cache: "no-store",
      });
      const json = await parseResponseJson<{ data?: DealHubOverview; error?: string }>(
        response,
      );
      if (!response.ok || !json.data) {
        throw new Error(json.error ?? "Failed to load deal hub overview");
      }
      return json.data;
    },
    initialData: initialData ?? undefined,
  });
}
