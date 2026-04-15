import type { OpsBlocker } from "./types/operations-core";

export function ProductionRiskPanel({ blockers }: { blockers: OpsBlocker[] }) {
  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-rose-900">Ризики та блокери</h3>
      <ul className="mt-3 space-y-2 text-xs text-rose-900">
        {blockers.length === 0 ? (
          <li className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">Критичних блокерів немає.</li>
        ) : (
          blockers.map((blocker) => (
            <li key={blocker.id} className="rounded-lg border border-rose-200 bg-white px-3 py-2">
              <p className="font-semibold">{blocker.title}</p>
              <p>{blocker.description}</p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
