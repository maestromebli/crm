"use client";

import type { SmartPanelContext } from "@/lib/dynamic-layer";

type Props = {
  context: SmartPanelContext;
  title?: string;
};

export function SmartPanelSummaryCard({ context, title = "Smart Panel" }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-3 text-xs shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </p>
      <p className="mt-1 text-[12px] font-medium text-[var(--enver-text)]">
        {context.nextAction?.label ?? "Дія не визначена"}
      </p>
      <p className="mt-1 text-[11px] text-slate-600">
        Risk meter: {context.riskMeter}% · Checklist:{" "}
        {context.checklist.filter((x) => x.done).length}/{context.checklist.length}
      </p>
      {context.missingData.length > 0 ? (
        <p className="mt-1 text-[11px] text-slate-500">
          Missing: {context.missingData.join(", ")}
        </p>
      ) : null}
    </section>
  );
}
