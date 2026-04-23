"use client";

import { cn } from "../../lib/utils";
import type {
  DealManagerJourneyAction,
  DealPrimaryNextAction,
} from "../../features/deal-workspace/deal-view-selectors";

type Props = {
  action: DealPrimaryNextAction;
  onAction: () => void;
  nextActions?: DealManagerJourneyAction[] | null;
  onOpenAction: (tab: DealManagerJourneyAction["tab"]) => void;
};

const STATE_LABELS: Record<DealManagerJourneyAction["state"], string> = {
  ok: "Норма",
  attention: "Увага",
  blocked: "Блокер",
};

export function DealHeroAction({
  action,
  onAction,
  nextActions,
  onOpenAction,
}: Props) {
  const safeNextActions = nextActions ?? [];

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
        Open: {action.label}
      </button>
      {safeNextActions.length > 0 ? (
        <div className="mt-4 border-t border-[var(--enver-border)] pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--enver-muted)]">
            Що далі
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {safeNextActions.slice(0, 3).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenAction(item.tab)}
                className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-2 text-left hover:bg-[var(--enver-hover)]"
              >
                <p className="text-xs font-semibold text-[var(--enver-text)]">{item.label}</p>
                <p className="mt-1 text-[11px] text-[var(--enver-text-muted)]">{item.hint}</p>
                <span
                  className={cn(
                    "mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    item.state === "blocked" && "border-rose-200 bg-rose-50 text-rose-900",
                    item.state === "attention" && "border-amber-200 bg-amber-50 text-amber-900",
                    item.state === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-900",
                  )}
                >
                  {STATE_LABELS[item.state]}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
