"use client";

import type { DealCriticalBlocker } from "../../features/deal-workspace/deal-view-selectors";

type Props = {
  blockers: DealCriticalBlocker[];
  onOpenBlocker: (index: number) => void;
};

export function DealBlockers({ blockers, onOpenBlocker }: Props) {
  if (blockers.length === 0) return null;
  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-900">Blockers</h3>
      <ul className="mt-2 space-y-2.5">
        {blockers.map((blocker, index) => (
          <li
            key={blocker.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-rose-100 bg-white/70 px-3 py-2"
          >
            <div className="min-w-0">
                <p className="text-sm font-medium text-rose-950">{blocker.title}</p>
              {blocker.description ? (
                <p className="text-xs text-rose-900/80">{blocker.description}</p>
              ) : null}
              <p className="mt-0.5 text-[11px] text-rose-900/70">{blocker.stageImpact}</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenBlocker(index)}
              className="rounded-lg border border-rose-200 bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-950 hover:bg-rose-200"
            >
              {blocker.ctaLabel}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
