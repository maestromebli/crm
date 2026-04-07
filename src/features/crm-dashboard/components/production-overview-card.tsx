import Link from "next/link";
import { Factory } from "lucide-react";
import type { ProductionOverview } from "../executive-types";

type ProductionOverviewCardProps = {
  data: ProductionOverview | null;
};

export function ProductionOverviewCard({ data }: ProductionOverviewCardProps) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--enver-border)] bg-[var(--enver-surface)]/40 p-5 text-sm text-[var(--enver-text-muted)]">
        Виробництво недоступне за вашими правами.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Factory className="h-4 w-4 text-[var(--enver-accent)]" />
          <h2 className="text-sm font-semibold text-[var(--enver-text)]">
            Виробництво
          </h2>
        </div>
        <div
          className="relative h-14 w-14 rounded-full border-4 border-[var(--enver-border)]"
          style={{
            background: `conic-gradient(var(--enver-accent) ${data.progressRingPct * 3.6}deg, var(--enver-surface) 0)`,
          }}
          title={`Прогрес цеху ~${data.progressRingPct}%`}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="У черзі" v={data.queued} />
        <Stat label="В роботі" v={data.inProgress} />
        <Stat label="Затримка" v={data.delayed} warn />
        <Stat label="Готово до відвантаження" v={data.readyForDelivery} />
        <Stat label="Завантаження" v={`${data.workerLoadPct}%`} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium uppercase text-[var(--enver-muted)]">
            Топ затримок
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {data.topDelayed.length === 0 ? (
              <li className="text-[var(--enver-text-muted)]">Немає критичних.</li>
            ) : (
              data.topDelayed.map((o) => (
                <li key={o.id} className="flex justify-between gap-2">
                  <span className="truncate">{o.dealTitle}</span>
                  <span className="shrink-0 text-rose-600">
                    +{o.daysLate} д
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase text-[var(--enver-muted)]">
            Термінові інциденти
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {data.urgentIssues.length === 0 ? (
              <li className="text-[var(--enver-text-muted)]">Немає відкритих.</li>
            ) : (
              data.urgentIssues.map((i) => (
                <li key={i.id} className="truncate text-[var(--enver-text)]">
                  {i.title}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      <div className="mt-4">
        <Link
          href="/crm/production"
          className="inline-flex rounded-lg bg-[var(--enver-accent)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-110"
        >
          Відкрити виробництво
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, v, warn }: { label: string; v: string | number; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-2">
      <p className="text-[10px] text-[var(--enver-muted)]">{label}</p>
      <p
        className={`text-sm font-semibold tabular-nums ${warn ? "text-rose-600" : "text-[var(--enver-text)]"}`}
      >
        {v}
      </p>
    </div>
  );
}
