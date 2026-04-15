import type { PurchaseStatus } from "@/features/production/types/operations-core";
import type { PurchaseTaskView } from "./PurchaseTaskCard";

const statuses: PurchaseStatus[] = [
  "NEED_TO_BUY",
  "IN_PROGRESS",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "ISSUE",
];

export function PurchaseStatusBar({ tasks }: { tasks: PurchaseTaskView[] }) {
  const counts = statuses.map((status) => ({
    status,
    count: tasks.filter((task) => task.status === status).length,
  }));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap gap-2 text-xs">
        {counts.map((row) => (
          <span key={row.status} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
            {row.status}: {row.count}
          </span>
        ))}
      </div>
    </section>
  );
}
