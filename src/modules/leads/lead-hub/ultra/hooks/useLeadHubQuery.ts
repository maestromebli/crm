"use client";

import { useQuery } from "@tanstack/react-query";
import type { LeadHubSessionDto } from "../domain/types";

export function useLeadHubQuery(id: string) {
  return useQuery({
    queryKey: ["lead-hub", id],
    queryFn: async () => {
      const res = await fetch(`/api/lead-hub/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load lead hub session");
      return (await res.json()) as LeadHubSessionDto;
    },
  });
}
