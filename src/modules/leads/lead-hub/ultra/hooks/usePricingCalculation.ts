"use client";

import { useEffect, useRef } from "react";
import { useLeadHubStore } from "./useLeadHubStore";
import {
  buildPricingSummary,
  buildPricingTotals,
  calculatePricingItem,
} from "@/modules/leads/lead-pricing/ultra/engine/calculate-pricing";
import type { PricingComputedItem } from "@/modules/leads/lead-pricing/ultra/engine/types";

export function usePricingCalculation() {
  const items = useLeadHubStore((s) => s.pricingState);
  const dirtyItemIds = useLeadHubStore((s) => s.dirtyItemIds);
  const setSession = useLeadHubStore((s) => s.setSession);
  const clearDirtyItems = useLeadHubStore((s) => s.clearDirtyItems);
  const computedMapRef = useRef<Map<string, PricingComputedItem>>(new Map());

  useEffect(() => {
    if (dirtyItemIds.length === 0) return;

    const timeout = window.setTimeout(() => {
      const session = useLeadHubStore.getState().session;
      if (!session) return;

      const dirtySet = new Set(dirtyItemIds);
      const existingIds = new Set(items.map((item) => item.id));
      for (const key of computedMapRef.current.keys()) {
        if (!existingIds.has(key)) computedMapRef.current.delete(key);
      }

      for (const item of items) {
        if (dirtySet.has(item.id) || !computedMapRef.current.has(item.id)) {
          computedMapRef.current.set(item.id, calculatePricingItem(item));
        }
      }

      const computedItems = items.map(
        (item) => computedMapRef.current.get(item.id) ?? calculatePricingItem(item),
      );
      const totals = buildPricingTotals(computedItems);
      const summary = buildPricingSummary(computedItems);

      setSession({
        ...session,
        totals,
        summary,
        items: computedItems,
      });
      clearDirtyItems();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [clearDirtyItems, dirtyItemIds, items, setSession]);
}
