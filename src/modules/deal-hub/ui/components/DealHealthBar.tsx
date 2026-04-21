import type { DealHubOverview } from "../../domain/deal.types";
import { DealCard } from "./_shared";

export function DealHealthBar({ data }: { data: DealHubOverview }) {
  const pct = Math.max(0, Math.min(100, data.health.score));
  const tone =
    data.health.status === "GOOD"
      ? "bg-emerald-500"
      : data.health.status === "WARNING"
        ? "bg-amber-500"
        : data.health.status === "RISK"
          ? "bg-orange-500"
          : "bg-rose-600";
  const statusLabel =
    data.health.status === "GOOD"
      ? "Добрий"
      : data.health.status === "WARNING"
        ? "Увага"
        : data.health.status === "RISK"
          ? "Ризик"
          : "Критично";
  return (
    <DealCard title="Стан замовлення" subtitle={data.health.reasons[0] ?? "Критичних ризиків немає"}>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-800">{statusLabel}</span>
        <span className="text-slate-500">{pct}%</span>
      </div>
    </DealCard>
  );
}
