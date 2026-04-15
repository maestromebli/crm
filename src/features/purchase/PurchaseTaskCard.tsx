import type { PurchaseStatus } from "@/features/production/types/operations-core";

export type PurchaseTaskView = {
  id: string;
  itemName: string;
  supplier?: string;
  code?: string;
  qty: number;
  orderName: string;
  urgency: "LOW" | "MEDIUM" | "HIGH";
  expectedAt?: string;
  status: PurchaseStatus;
};

export function PurchaseTaskCard({ task }: { task: PurchaseTaskView }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-900">{task.itemName}</h4>
      <p className="text-xs text-slate-600">{task.orderName}</p>
      <p className="text-xs text-slate-500">{task.supplier ?? "Постачальник не вказаний"} · {task.qty} шт.</p>
      <p className="mt-1 text-xs text-slate-700">{task.status}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-md border border-slate-300 px-2 py-1 text-[11px]">Позначити замовлено</button>
        <button className="rounded-md border border-slate-300 px-2 py-1 text-[11px]">Позначити отримано</button>
      </div>
    </article>
  );
}
