import type { DealHubOverview } from "../../domain/deal.types";
import { DealCard } from "./_shared";

export function DealRiskPanel({ data }: { data: DealHubOverview }) {
  return (
    <DealCard title="Радар ризиків" subtitle="Поточні блокери й попередження">
      {data.risks.length === 0 ? (
        <p className="text-xs text-slate-500">Активних ризиків немає.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.risks.map((risk) => (
            <li key={risk.id} className="text-xs">
              <span
                className={
                  risk.severity === "critical"
                    ? "font-semibold text-rose-600"
                    : risk.severity === "risk"
                      ? "font-semibold text-orange-600"
                      : "font-semibold text-amber-600"
                }
              >
                {risk.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DealCard>
  );
}
