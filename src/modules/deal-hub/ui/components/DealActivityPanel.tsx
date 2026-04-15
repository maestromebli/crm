import type { DealHubOverview } from "../../domain/deal.types";
import { DealCard } from "./_shared";

export function DealActivityPanel({ data }: { data: DealHubOverview }) {
  return (
    <DealCard title="Активність">
      <ul className="space-y-1">
        {data.timelinePreview.slice(0, 4).map((item) => (
          <li key={item.id} className="text-xs text-slate-700">
            {item.title}
          </li>
        ))}
      </ul>
    </DealCard>
  );
}
