import type { DealHubOverview } from "../../domain/deal.types";
import { DealCard } from "./_shared";

export function DealPricingSummary({ data }: { data: DealHubOverview }) {
  return (
    <DealCard title="Ціноутворення">
      <p className="text-xs text-slate-600">Остання версія: {data.pricing.latestVersionLabel ?? "-"}</p>
      <p className="text-xs text-slate-600">Кошторисів: {data.pricing.estimatesCount}</p>
      <p className="text-xs text-slate-600">
        Маржа: {data.pricing.marginPct != null ? `${data.pricing.marginPct.toFixed(1)}%` : "-"}
      </p>
    </DealCard>
  );
}
