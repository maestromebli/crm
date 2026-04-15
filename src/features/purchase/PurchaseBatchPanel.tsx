import type { PurchaseTaskView } from "./PurchaseTaskCard";

export function PurchaseBatchPanel({ tasks }: { tasks: PurchaseTaskView[] }) {
  const bySupplier = tasks.reduce<Record<string, number>>((acc, task) => {
    const key = task.supplier ?? "Без постачальника";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Batch закупівлі</h3>
      <ul className="mt-3 space-y-1 text-xs text-slate-700">
        {Object.entries(bySupplier).map(([supplier, count]) => (
          <li key={supplier} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span>{supplier}</span>
            <span>{count}</span>
          </li>
        ))}
      </ul>
      <button className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white">Об&apos;єднати в одне замовлення</button>
    </section>
  );
}
