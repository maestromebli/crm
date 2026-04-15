import type { DealTimelineEventItem } from "../../domain/deal-timeline.types";
import { DealCard } from "./_shared";

export function DealTimeline({ items }: { items: DealTimelineEventItem[] }) {
  return (
    <DealCard title="Таймлайн" subtitle="Критичні події та переходи">
      <div className="space-y-2">
        {items.slice(0, 12).map((item) => (
          <div key={item.id} className="rounded-md border border-slate-200 p-2">
            <p className="text-xs font-semibold text-slate-900">{item.title}</p>
            <p className="text-[11px] text-slate-500">
              {new Date(item.occurredAt).toLocaleString("uk-UA")} · {item.actorName ?? "Система"}
            </p>
          </div>
        ))}
      </div>
    </DealCard>
  );
}
