import type { DealHubOverview } from "../../domain/deal.types";
import { DealCard } from "./_shared";

export function DealProductionSummary({ data }: { data: DealHubOverview }) {
  return (
    <DealCard title="Виробництво">
      <p className="text-xs text-slate-600">Готовність: {data.production.readiness}</p>
      <p className="text-xs text-slate-600">Передача: {data.production.handoffStatus ?? "-"}</p>
      <p className="text-xs text-slate-600">Блокери: {data.production.blockersCount}</p>
    </DealCard>
  );
}
