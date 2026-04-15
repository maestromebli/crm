import type { ChecklistItem } from "@/features/production/types/operations-core";

export function InstallationChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Checklist перед монтажем</h3>
      <ul className="mt-3 space-y-2 text-xs">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span>{item.label}</span>
            <span className={item.done ? "text-emerald-700" : "text-amber-700"}>{item.done ? "OK" : "Очікує"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
