type HeaderAction = {
  id: string;
  label: string;
  onClick: () => void;
};

type Props = {
  title: string;
  scopeLabel: string;
  periodLabel: string;
  totalActiveOrders: number;
  overdueCount: number;
  blockedCount: number;
  overloadedWorkshopsCount: number;
  nextQuickActions: HeaderAction[];
  syncedLabel: string;
};

export function ProductionCommandHeader({
  title,
  scopeLabel,
  periodLabel,
  totalActiveOrders,
  overdueCount,
  blockedCount,
  overloadedWorkshopsCount,
  nextQuickActions,
  syncedLabel,
}: Props) {
  return (
    <header className="enver-panel rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--enver-text)]">{title}</h1>
          <p className="mt-1 text-xs text-[var(--enver-text-muted)]">
            {scopeLabel} · {periodLabel} · синхронізовано {syncedLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {nextQuickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-1.5 text-xs font-medium text-[var(--enver-text-muted)] hover:bg-[var(--enver-hover)] hover:text-[var(--enver-text)]"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Активні замовлення" value={totalActiveOrders} tone="neutral" />
        <Metric label="Прострочені" value={overdueCount} tone={overdueCount > 0 ? "danger" : "ok"} />
        <Metric label="Заблоковані" value={blockedCount} tone={blockedCount > 0 ? "warning" : "ok"} />
        <Metric
          label="Перевантажені цехи"
          value={overloadedWorkshopsCount}
          tone={overloadedWorkshopsCount > 0 ? "danger" : "ok"}
        />
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "warning" | "danger" | "ok";
}) {
  const toneClass =
    tone === "danger"
      ? "border-[var(--enver-danger)]/30 bg-[var(--enver-danger-soft)] text-[var(--enver-danger)]"
      : tone === "warning"
        ? "border-[var(--enver-warning)]/30 bg-[var(--enver-warning-soft)] text-[var(--enver-warning)]"
        : tone === "ok"
          ? "border-[var(--enver-success)]/30 bg-[var(--enver-success-soft)] text-[var(--enver-success)]"
          : "border-[var(--enver-border)] bg-[var(--enver-surface)] text-[var(--enver-text)]";
  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
