export type CapacityItem = { stage: string; loadPercent: number };

export function ProductionCapacityPanel({ capacity }: { capacity: CapacityItem[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Завантаження виробництва</h3>
      <div className="mt-3 space-y-2">
        {capacity.map((item) => (
          <div key={item.stage}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span>{item.stage}</span>
              <span>{item.loadPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div className={`h-2 rounded-full ${item.loadPercent >= 85 ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, item.loadPercent)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
