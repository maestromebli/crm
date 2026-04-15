import type { DealHubOverview } from "../../domain/deal.types";
import { DealCard } from "./_shared";

export function DealClientCard({ data }: { data: DealHubOverview }) {
  return (
    <DealCard title="Клієнт">
      <p className="text-xs font-semibold text-slate-900">{data.client?.name ?? "-"}</p>
      <p className="text-[11px] text-slate-500">
        Контакт: {data.client?.primaryContactName ?? "Не вказано"}
      </p>
    </DealCard>
  );
}
