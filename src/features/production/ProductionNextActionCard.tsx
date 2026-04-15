import type { NextProductionAction } from "./types/operations-core";

export function ProductionNextActionCard({ action }: { action: NextProductionAction }) {
  return (
    <section className="rounded-2xl border border-slate-900 bg-slate-900 p-5 text-white shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-300">Наступний крок</p>
      <h3 className="mt-1 text-xl font-semibold">{action.label}</h3>
      <p className="mt-2 text-sm text-slate-300">{action.description}</p>
      <button
        disabled={action.disabled}
        className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Наступний крок
      </button>
      {action.reasonIfDisabled ? <p className="mt-2 text-xs text-amber-300">{action.reasonIfDisabled}</p> : null}
    </section>
  );
}
