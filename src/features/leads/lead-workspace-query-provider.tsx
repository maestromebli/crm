"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { createCrmQueryClient } from "@/lib/query";

export function LeadWorkspaceQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState<QueryClient>(() => createCrmQueryClient());

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
