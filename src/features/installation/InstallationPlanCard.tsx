import type { InstallationStatus } from "@/features/production/types/operations-core";

export type InstallationPlan = {
  id: string;
  orderName: string;
  address: string;
  contact: string;
  team: string;
  plannedAt?: string;
  status: InstallationStatus;
};

export function InstallationPlanCard({ plan }: { plan: InstallationPlan }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-900">{plan.orderName}</h4>
      <p className="text-xs text-slate-600">{plan.address}</p>
      <p className="text-xs text-slate-500">{plan.contact} · {plan.team}</p>
      <p className="mt-1 text-xs text-slate-700">{plan.status}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white">Підтвердити дату</button>
        <button className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-medium">Почати монтаж</button>
        <button className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-medium">Завершити монтаж</button>
      </div>
    </article>
  );
}
