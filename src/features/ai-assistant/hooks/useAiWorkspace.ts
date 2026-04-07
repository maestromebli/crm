"use client";

import { useCallback, useEffect, useState } from "react";
import type { AiWorkspacePayload } from "../../ai/workspace/types";
import type { ResolvedPageContext } from "../types";

export function useAiWorkspace(input: {
  page: ResolvedPageContext;
  enabled: boolean;
  panelOpen: boolean;
}): {
  workspace: AiWorkspacePayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [workspace, setWorkspace] = useState<AiWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leadId = input.page.leadId;
  const dealId = input.page.dealId;

  const load = useCallback(async () => {
    if (!input.enabled || !input.panelOpen) return;
    if (!leadId && !dealId) {
      setWorkspace(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = leadId
        ? `leadId=${encodeURIComponent(leadId)}`
        : `dealId=${encodeURIComponent(dealId!)}`;
      const res = await fetch(`/api/ai/workspace?${q}`);
      const data = (await res.json()) as AiWorkspacePayload & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не вдалося завантажити контекст AI");
        setWorkspace(null);
        return;
      }
      setWorkspace(data);
    } catch {
      setError("Помилка мережі");
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, [input.enabled, input.panelOpen, leadId, dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { workspace, loading, error, refresh: load };
}
