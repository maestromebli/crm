"use client";

import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import type {
  DealProductionReadiness,
  DealSmartInsight,
  DealWarning,
} from "../../features/deal-workspace/deal-view-selectors";

export function DealProductionReadinessCard({
  readiness,
  insights,
  warnings,
  onTab,
}: {
  readiness: DealProductionReadiness;
  insights: DealSmartInsight[];
  warnings: DealWarning[];
  onTab: (tab: DealWorkspaceTabId) => void;
}) {
  const compactInsights = insights.slice(0, 3);
  return (
    <section className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
        Готовність до виробництва
      </p>
      <p className="mt-1 text-xs text-[var(--enver-text-muted)]">
        {readiness.label}:{" "}
        <span className="font-medium text-[var(--enver-text)]">
          {readiness.done}/{readiness.total}
        </span>
      </p>
      <button
        type="button"
        onClick={() => onTab("handoff")}
        className="mt-2 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--enver-text)]"
      >
        Відкрити передачу
      </button>
      <details className="mt-3 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] p-2">
        <summary className="cursor-pointer text-[11px] font-semibold text-[var(--enver-text)]">
          Smart insights
        </summary>
        <ul className="mt-2 space-y-1 text-[11px] text-[var(--enver-text-muted)]">
          {compactInsights.map((item) => (
            <li key={item.id}>- {item.title}</li>
          ))}
          {warnings.slice(0, 1).map((item) => (
            <li key={item.id}>- Рекомендація: {item.title}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
