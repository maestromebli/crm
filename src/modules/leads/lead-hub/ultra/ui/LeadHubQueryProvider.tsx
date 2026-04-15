"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createCrmQueryClient } from "@/lib/query/query-client-defaults";

export function LeadHubQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState<QueryClient>(() => createCrmQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
