"use client";

import type { DealWorkspacePayload, DealWorkspaceTabId } from "../../features/deal-workspace/types";

export function DealDocumentsTasksCard({
  data,
  onTab,
}: {
  data: DealWorkspacePayload;
  onTab: (tab: DealWorkspaceTabId) => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
        Документи та задачі
      </h3>
      <ul className="mt-2 space-y-1.5 text-xs text-[var(--enver-text-muted)]">
        <li>
          Договір:{" "}
          <span className="font-medium text-[var(--enver-text)]">
            {data.contract?.status ?? "не створено"}
          </span>
        </li>
        <li>
          Файли:{" "}
          <span className="font-medium text-[var(--enver-text)]">
            {data.attachmentsCount}
          </span>
        </li>
        <li>
          Задачі:{" "}
          <span className="font-medium text-[var(--enver-text)]">
            {data.operationalStats.openTasksCount} відкрито / {data.operationalStats.overdueOpenTasksCount} прострочено
          </span>
        </li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onTab("contract")}
          className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--enver-text)]"
        >
          Договір
        </button>
        <button
          type="button"
          onClick={() => onTab("files")}
          className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--enver-text)]"
        >
          Файли
        </button>
        <button
          type="button"
          onClick={() => onTab("tasks")}
          className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--enver-text)]"
        >
          Задачі
        </button>
      </div>
      {data.leadId ? (
        <p className="mt-2 text-[11px] text-[var(--enver-muted)]">
          Дані і файли синхронізовані з конверсії ліда.
        </p>
      ) : null}
    </section>
  );
}
