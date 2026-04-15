"use client";

import { useEffect, useRef } from "react";
import { useLeadHubStore } from "./useLeadHubStore";

async function persistPricingSession(
  pricingSessionId: string,
  items: ReturnType<typeof useLeadHubStore.getState>["pricingState"],
) {
  const response = await fetch("/api/pricing/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pricingSessionId,
      items,
      summaryNote: "Autosave queue write",
    }),
  });
  if (!response.ok) throw new Error(`Autosave failed: ${response.status}`);
}

export function useLeadHubAutosave() {
  const session = useLeadHubStore((s) => s.session);
  const pricingState = useLeadHubStore((s) => s.pricingState);
  const pendingChanges = useLeadHubStore((s) => s.syncState.pendingChanges);
  const setSyncState = useLeadHubStore((s) => s.setSyncState);

  const runningRef = useRef(false);
  const retryRef = useRef(0);

  useEffect(() => {
    if (!session || !pendingChanges) return;

    const timeout = window.setTimeout(async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      setSyncState({ isSaving: true, lastError: undefined });
      try {
        await persistPricingSession(session.pricingSessionId, pricingState);
        retryRef.current = 0;
        setSyncState({
          isSaving: false,
          pendingChanges: false,
          lastSavedAt: Date.now(),
          lastError: undefined,
        });
      } catch (error) {
        retryRef.current += 1;
        const maxRetry = 3;
        setSyncState({
          isSaving: false,
          pendingChanges: retryRef.current < maxRetry,
          lastError:
            error instanceof Error ? error.message : "Autosave failed unexpectedly",
        });
      } finally {
        runningRef.current = false;
      }
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [pendingChanges, pricingState, session, setSyncState]);
}
