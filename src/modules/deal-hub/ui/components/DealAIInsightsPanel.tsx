import type { DealHubOverview } from "../../domain/deal.types";
import { DealCard } from "./_shared";

export function DealAIInsightsPanel({ data }: { data: DealHubOverview }) {
  return (
    <DealCard title="AI-інсайти" subtitle="Лише рекомендації, не джерело істини">
      <ul className="space-y-1 text-xs text-slate-700">
        {data.стан.suggestedActions.slice(0, 4).map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </DealCard>
  );
}
