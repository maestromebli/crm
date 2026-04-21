import type { DealHubOverview } from "../../domain/deal.types";
import { DealCard } from "./_shared";

function money(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 0,
  }).format(value);
}

function readinessLabel(value: "ready" | "not_ready" | "blocked"): string {
  if (value === "ready") return "Готово";
  if (value === "blocked") return "Заблоковано";
  return "Не готово";
}

export function DealOverviewCard({ data }: { data: DealHubOverview }) {
  return (
    <DealCard title="Зріз замовлення" subtitle="Комерція + фінанси + готовність">
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 md:grid-cols-3">
        <div>
          <p className="text-slate-500">Погоджена ціна</p>
          <p className="font-semibold text-slate-900">{money(data.pricing.approvedTotal)}</p>
        </div>
        <div>
          <p className="text-slate-500">Сплачено</p>
          <p className="font-semibold text-slate-900">{money(data.finance.paidAmount)}</p>
        </div>
        <div>
          <p className="text-slate-500">До сплати</p>
          <p className="font-semibold text-slate-900">{money(data.finance.outstandingAmount)}</p>
        </div>
        <div>
          <p className="text-slate-500">Маржа</p>
          <p className="font-semibold text-slate-900">
            {data.pricing.marginPct != null ? `${data.pricing.marginPct.toFixed(1)}%` : "-"}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Виробництво</p>
          <p className="font-semibold text-slate-900">
            {readinessLabel(data.production.readiness)}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Дата монтажу</p>
          <p className="font-semibold text-slate-900">
            {data.installation.plannedDate
              ? new Date(data.installation.plannedDate).toLocaleDateString("uk-UA")
              : "-"}
          </p>
        </div>
      </div>
    </DealCard>
  );
}
