import type { ProductionCommandCenterView } from "../../types/production";
import { getWorkshopLoadState } from "./planning-selectors";

type CapacitySummary = {
  capacity: number;
  allocatedLoad: number;
  utilization: number;
  overdueItemsCount: number;
  atRiskItemsCount: number;
  nextAvailableSlot: string;
};

export function WorkshopLoadGrid({
  stations,
  capacitySummary,
}: {
  stations: ProductionCommandCenterView["stationLoads"];
  capacitySummary: CapacitySummary;
}) {
  return (
    <section className="enver-panel rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">Огляд потужності та завантаження</h2>
        <p className="text-xs text-[var(--enver-text-muted)]">
          Завантаження {capacitySummary.utilization}% · Прострочено {capacitySummary.overdueItemsCount} · Під ризиком{" "}
          {capacitySummary.atRiskItemsCount}
        </p>
      </div>
      <p className="mb-3 text-xs text-[var(--enver-text-muted)]">Найближчий вільний слот: {capacitySummary.nextAvailableSlot}</p>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {stations.map((station) => {
          const state = getWorkshopLoadState(station);
          return (
            <article key={station.stationKey} className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--enver-text)]">{station.stationLabel}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stateClass(state.key)}`}>{state.label}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--enver-text-muted)]">
                потужність 100 · розподілено {station.loadPercent} · завантаження {station.loadPercent}%
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--enver-hover)]">
                <div className={`h-full rounded-full ${barClass(state.key)}`} style={{ width: `${Math.min(100, station.loadPercent)}%` }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function stateClass(state: ReturnType<typeof getWorkshopLoadState>["key"]) {
  if (state === "overloaded") return "bg-[var(--enver-danger-soft)] text-[var(--enver-danger)]";
  if (state === "near_capacity") return "bg-[var(--enver-warning-soft)] text-[var(--enver-warning)]";
  if (state === "blocked") return "bg-[var(--enver-warning-soft)] text-[var(--enver-warning)]";
  if (state === "balanced") return "bg-[var(--enver-success-soft)] text-[var(--enver-success)]";
  return "bg-[var(--enver-hover)] text-[var(--enver-text-muted)]";
}

function barClass(state: ReturnType<typeof getWorkshopLoadState>["key"]) {
  if (state === "overloaded") return "bg-rose-500";
  if (state === "near_capacity") return "bg-amber-500";
  if (state === "blocked") return "bg-orange-500";
  return "bg-emerald-500";
}
