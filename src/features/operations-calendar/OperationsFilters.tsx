export type OperationsFilterState = {
  measurements: boolean;
  constructorDeadlines: boolean;
  productionMilestones: boolean;
  purchaseDeliveries: boolean;
  installations: boolean;
};

export function OperationsFilters({ state }: { state: OperationsFilterState }) {
  const chips = [
    ["Заміри", state.measurements],
    ["Конструктор", state.constructorDeadlines],
    ["Виробництво", state.productionMilestones],
    ["Поставки", state.purchaseDeliveries],
    ["Монтаж", state.installations],
  ] as const;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap gap-2 text-xs">
        {chips.map(([label, enabled]) => (
          <span key={label} className={`rounded-full px-2.5 py-1 ${enabled ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
