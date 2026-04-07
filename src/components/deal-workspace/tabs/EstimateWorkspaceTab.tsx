"use client";

import type { DealWorkspacePayload } from "../../../features/deal-workspace/types";
import { EstimateWorkspacePage } from "../../../features/estimate/components/EstimateWorkspacePage";

export type EstimateVisibility = "director" | "head" | "sales";

export function EstimateWorkspaceTab({
  data,
  estimateVisibility = "sales",
}: {
  data: DealWorkspacePayload;
  estimateVisibility?: EstimateVisibility;
}) {
  return (
    <EstimateWorkspacePage
      dealId={data.deal.id}
      dealTitle={data.deal.title}
      estimateVisibility={estimateVisibility}
    />
  );
}
