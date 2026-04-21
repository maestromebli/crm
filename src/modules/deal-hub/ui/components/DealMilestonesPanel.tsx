import type { DealHubOverview } from "../../domain/deal.types";
import { DEAL_HUB_STAGE_LABELS } from "../../domain/deal.constants";
import { DealCard } from "./_shared";

export function DealMilestonesPanel({ data }: { data: DealHubOverview }) {
  const blocked = data.stageGates.filter((item) => !item.passed).length;
  return (
    <DealCard title="Віхи" subtitle={`${blocked} заблокованих переходів`}>
      <ul className="space-y-1">
        {data.stageGates.slice(0, 6).map((gate) => (
          <li key={gate.stage} className="text-xs text-slate-700">
            {DEAL_HUB_STAGE_LABELS[gate.stage]}:{" "}
            {gate.passed ? "ОК" : `${gate.missing.length} відсутньо`}
          </li>
        ))}
      </ul>
    </DealCard>
  );
}
