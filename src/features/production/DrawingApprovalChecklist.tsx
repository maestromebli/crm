import type { ChecklistItem } from "./types/operations-core";

export function DrawingApprovalChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Checklist перевірки креслень</h3>
      <ul className="mt-3 space-y-2 text-xs">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span>{item.label}</span>
            <span className={item.done ? "text-emerald-700" : "text-amber-700"}>{item.done ? "OK" : "Перевірити"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
