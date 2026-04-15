import type { DealHubOverview } from "../../domain/deal.types";
import { DealCard } from "./_shared";

export function DealInstallationSummary({ data }: { data: DealHubOverview }) {
  return (
    <DealCard title="Монтаж">
      <p className="text-xs text-slate-600">Готовність: {data.installation.readiness}</p>
      <p className="text-xs text-slate-600">
        Дата:{" "}
        {data.installation.plannedDate
          ? new Date(data.installation.plannedDate).toLocaleDateString("uk-UA")
          : "-"}
      </p>
    </DealCard>
  );
}
