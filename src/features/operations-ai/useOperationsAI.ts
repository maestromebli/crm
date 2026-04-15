"use client";

import { useMemo } from "react";
import { operationsAIEngine } from "./operationsAIEngine";
import type { ProductionOrderOpsState } from "@/features/production/types/operations-core";

export function useOperationsAI(order: ProductionOrderOpsState) {
  return useMemo(() => operationsAIEngine(order), [order]);
}
