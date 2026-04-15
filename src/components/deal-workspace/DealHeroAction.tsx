"use client";

import type { DealPrimaryNextAction } from "../../features/deal-workspace/deal-view-selectors";

type Props = {
  action: DealPrimaryNextAction;
  onAction: () => void;
};

export function DealHeroAction({ action, onAction }: Props) {
  return (
    <section className="rounded-3xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--enver-muted)]">
        Що зробити зараз
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--enver-text)]">
        {action.label}
      </h2>
      {action.deadlineLabel ? (
        <p className="mt-2 text-xs font-medium text-amber-800">Дедлайн: {action.deadlineLabel}</p>
      ) : null}
      <ul className="mt-3 space-y-1.5 text-sm text-[var(--enver-text-muted)]">
        {action.reasons.slice(0, 3).map((reason) => (
          <li key={reason}>- {reason}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 rounded-xl bg-[var(--enver-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
      >
        {action.label}
      </button>
    </section>
  );
}
