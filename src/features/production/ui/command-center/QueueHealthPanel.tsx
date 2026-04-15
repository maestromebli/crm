type QueueHealth = {
  total: number;
  overdue: number;
  blocked: number;
  atRisk: number;
  inProduction: number;
  readyToStart: number;
  queued: number;
  healthScore: number;
};

export function QueueHealthPanel({ queueHealth }: { queueHealth: QueueHealth }) {
  return (
    <section className="enver-panel rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">Стан черги та активна робота</h2>
        <span className="text-xs text-[var(--enver-text-muted)]">Індекс стану {queueHealth.healthScore}/100</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Cell label="У виробництві" value={queueHealth.inProduction} />
        <Cell label="У черзі" value={queueHealth.queued} />
        <Cell label="Готово до старту" value={queueHealth.readyToStart} />
        <Cell label="Заблоковано" value={queueHealth.blocked} tone="warning" />
        <Cell label="Під ризиком" value={queueHealth.atRisk} tone="warning" />
        <Cell label="Прострочено" value={queueHealth.overdue} tone="danger" />
      </div>
    </section>
  );
}

function Cell({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warning" | "danger" }) {
  const toneClass =
    tone === "danger"
      ? "border-[var(--enver-danger)]/30 bg-[var(--enver-danger-soft)] text-[var(--enver-danger)]"
      : tone === "warning"
        ? "border-[var(--enver-warning)]/30 bg-[var(--enver-warning-soft)] text-[var(--enver-warning)]"
        : "border-[var(--enver-border)] bg-[var(--enver-surface)] text-[var(--enver-text)]";
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
