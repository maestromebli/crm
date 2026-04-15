import type { DealHubOverview } from "../../domain/deal.types";
import { DEAL_HUB_STAGE_ORDER } from "../../domain/deal.status";
import { DealCard } from "./_shared";

export function DealStageRail({ data }: { data: DealHubOverview }) {
  const currentIdx = DEAL_HUB_STAGE_ORDER.indexOf(data.deal.stage);
  return (
    <DealCard title="Стрічка етапів" subtitle="Прогрес і блокери переходів">
      <ol className="space-y-2">
        {DEAL_HUB_STAGE_ORDER.map((stage, idx) => {
          const gate = data.stageGates.find((item) => item.stage === stage);
          const done = idx < currentIdx;
          const current = idx === currentIdx;
          return (
            <li key={stage} className="text-xs">
              <div className="flex items-center justify-between">
                <span
                  className={
                    done
                      ? "font-semibold text-emerald-700"
                      : current
                        ? "font-semibold text-slate-900"
                        : "text-slate-500"
                  }
                >
                  {stage}
                </span>
                {!gate?.passed && gate?.missing.length ? (
                  <span className="text-[10px] text-rose-600">{gate.missing.length} відсутньо</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </DealCard>
  );
}
