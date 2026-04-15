import { PurchaseNeedList } from "./PurchaseNeedList";
import { PurchaseBatchPanel } from "./PurchaseBatchPanel";
import { PurchaseStatusBar } from "./PurchaseStatusBar";
import type { PurchaseTaskView } from "./PurchaseTaskCard";

export function PurchaseBoardPage({ tasks }: { tasks: PurchaseTaskView[] }) {
  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Purchase Board</h1>
        <p className="text-sm text-slate-600">Простий візуальний контроль закупівель без ERP-перевантаження.</p>
      </header>

      <PurchaseStatusBar tasks={tasks} />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <PurchaseNeedList tasks={tasks} />
        <PurchaseBatchPanel tasks={tasks} />
      </div>
    </div>
  );
}
