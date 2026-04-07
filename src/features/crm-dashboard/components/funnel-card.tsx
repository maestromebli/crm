import type { FunnelStageRow } from "../executive-types";
import { cn } from "../../../lib/utils";

type FunnelCardProps = {
  stages: FunnelStageRow[];
  emptyHint?: string;
};

export function FunnelCard({
  stages,
  emptyHint = "Немає даних воронки для поточних фільтрів.",
}: FunnelCardProps) {
  if (!stages.length) {
    return (
      <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">
          Воронка продажів
        </h2>
        <p className="mt-3 text-sm text-[var(--enver-text-muted)]">{emptyHint}</p>
      </div>
    );
  }

  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">
          Воронка продажів
        </h2>
        <span className="text-[11px] text-[var(--enver-muted)]">
          кількість · сума · конверсія
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {stages.map((s, idx) => {
          const w = Math.round((s.count / maxCount) * 100);
          return (
            <div
              key={s.stageId}
              className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)]/80 p-3 transition duration-200 hover:border-[var(--enver-border-strong)] hover:shadow-[var(--enver-shadow)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-[var(--enver-text)]">
                    {s.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--enver-text-muted)]">
                    {s.count.toLocaleString("uk-UA")} ·{" "}
                    {Math.round(s.amount).toLocaleString("uk-UA")} ₴
                    {s.conversionPct != null && idx > 0 ? (
                      <span className="ml-1">
                        · конв. {s.conversionPct.toFixed(0)}%
                        {s.dropoffPct != null ? ` · −${s.dropoffPct.toFixed(0)}%` : ""}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--enver-border)]">
                <div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r from-[var(--enver-accent)]/90 to-[var(--enver-accent)]/50",
                  )}
                  style={{ width: `${Math.max(6, w)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
