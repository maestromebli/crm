import type { DealHubOverview } from "../../domain/deal.types";
import { DealCard } from "./_shared";

function activityTypeLabel(type: string): string {
  const upper = type.toUpperCase();
  if (upper.includes("DEAL_CREATED")) return "Замовлення створено";
  if (upper.includes("STAGE")) return "Змінено етап";
  if (upper.includes("KP") || upper.includes("PRICING")) return "Оновлено КП/ціноутворення";
  if (upper.includes("CONTRACT")) return "Оновлено договір";
  if (upper.includes("PAYMENT")) return "Оновлено оплату";
  if (upper.includes("PRODUCTION")) return "Оновлено виробництво";
  if (upper.includes("PROCUREMENT")) return "Оновлено закупівлю";
  if (upper.includes("INSTALLATION")) return "Оновлено монтаж";
  return "Системна подія";
}

export function DealActivityPanel({ data }: { data: DealHubOverview }) {
  return (
    <DealCard title="Активність">
      <ul className="space-y-1">
        {data.timelinePreview.slice(0, 4).map((item) => (
          <li key={item.id} className="text-xs text-slate-700">
            {/^[A-Z0-9_]+$/.test(item.title.trim())
              ? activityTypeLabel(item.title)
              : item.title.trim() || activityTypeLabel(item.type)}
          </li>
        ))}
      </ul>
    </DealCard>
  );
}
