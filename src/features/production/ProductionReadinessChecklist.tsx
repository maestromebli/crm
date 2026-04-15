import type { ChecklistItem } from "./types/operations-core";

export function ProductionReadinessChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Checklist готовності</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
            <span className="text-slate-800">{item.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.done ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
              {item.done ? "Готово" : "Очікує"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
