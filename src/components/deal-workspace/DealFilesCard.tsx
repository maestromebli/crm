"use client";

import type { DealWorkspacePayload, DealWorkspaceTabId } from "../../features/deal-workspace/types";

export function DealFilesCard({
  data,
  onTab,
}: {
  data: DealWorkspacePayload;
  onTab: (tab: DealWorkspaceTabId) => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
        Файли
      </p>
      <p className="mt-1 text-xs text-[var(--enver-text-muted)]">
        Усього: <span className="font-medium text-[var(--enver-text)]">{data.attachmentsCount}</span>
      </p>
      <button
        type="button"
        onClick={() => onTab("files")}
        className="mt-2 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--enver-text)]"
      >
        Відкрити файли
      </button>
    </section>
  );
}
