"use client";

import { useQuery } from "@tanstack/react-query";
import type { DealTimelineEventItem } from "../../domain/deal-timeline.types";
import { parseResponseJson } from "@/lib/api/parse-response-json";

export function useDealTimeline(dealId: string) {
  return useQuery({
    queryKey: ["deal-hub", "timeline", dealId],
    queryFn: async () => {
      const response = await fetch(`/api/deals/${dealId}/timeline`, { cache: "no-store" });
      const json = await parseResponseJson<{ data?: DealTimelineEventItem[] }>(response);
      return json.data ?? [];
    },
  });
}
