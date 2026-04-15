"use client";

import type { DealWorkspacePayload, DealWorkspaceTabId } from "../../features/deal-workspace/types";

export function DealContractCard({
  data,
  onTab,
}: {
  data: DealWorkspacePayload;
  onTab: (tab: DealWorkspaceTabId) => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
        Договір
      </p>
      <p className="mt-1 text-xs text-[var(--enver-text-muted)]">
        Статус: <span className="font-medium text-[var(--enver-text)]">{data.contract?.status ?? "Не створено"}</span>
      </p>
      <button
        type="button"
        onClick={() => onTab("contract")}
        className="mt-2 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--enver-text)]"
      >
        Відкрити договір
      </button>
    </section>
  );
}
