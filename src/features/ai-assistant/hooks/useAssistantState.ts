"use client";

import { useMemo } from "react";
import type {
  AssistantResolvedContext,
  AssistantVisualState,
} from "../types";

type Params = {
  resolved: AssistantResolvedContext;
  loading: boolean;
  hasError: boolean;
  tabVisible: boolean;
  /** Панель відкрита — помічник у режимі «слухаю», без конфлікту з thinking */
  panelOpen: boolean;
};

/**
 * Єдине джерело візуального стану віджета без зайвих перерисувань.
 */
export function useAssistantState({
  resolved,
  loading,
  hasError,
  tabVisible,
  panelOpen,
}: Params): {
  visualState: AssistantVisualState;
  badgeCount: number;
} {
  const visualState = useMemo((): AssistantVisualState => {
    if (!tabVisible) return "sleeping";
    if (hasError) return "error";
    if (loading) return "thinking";
    if (panelOpen) return "listening";
    const risky = resolved.recommendations.some(
      (r) => r.level === "warning" || r.level === "error",
    );
    if (risky) return "warning";
    return "idle";
  }, [tabVisible, hasError, loading, panelOpen, resolved.recommendations]);

  const badgeCount = useMemo(
    () => Math.min(9, resolved.recommendationCount),
    [resolved.recommendationCount],
  );

  return { visualState, badgeCount };
}
