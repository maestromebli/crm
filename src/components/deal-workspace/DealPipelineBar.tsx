"use client";

import type { DealWorkspacePayload, DealWorkspaceTabId } from "../../features/deal-workspace/types";
import type { DealPipelineStepState } from "../../features/deal-workspace/deal-view-selectors";
import { DealPipelineProgress } from "./DealPipelineProgress";

export function DealPipelineBar({
  steps,
  data,
  onTab,
}: {
  steps: DealPipelineStepState[];
  data: DealWorkspacePayload;
  onTab: (tab: DealWorkspaceTabId) => void;
}) {
  return <DealPipelineProgress steps={steps} data={data} onTab={onTab} />;
}
