import type { OpsAiInsight, ProductionOrderOpsState } from "./types/operations-core";

function card(label: string, value: number) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}

export function ProductionChiefDashboard({ orders, aiRisks }: { orders: ProductionOrderOpsState[]; aiRisks: OpsAiInsight[] }) {
  const delayed = orders.filter((o) => o.productionStage === "DELAYED").length;
  const blocked = orders.filter((o) => o.blockers.length > 0).length;
  const waitingPurchase = orders.filter((o) => o.materialsReadiness === "TO_BUY" || o.materialsReadiness === "PARTIAL").length;
  const readyInstall = orders.filter((o) => o.productionStage === "READY").length;

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Production Chief Dashboard</h1>
        <p className="text-sm text-slate-600">Штаб розбору польотів: що горить, що блокує, що рухати зараз.</p>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {card("Активні замовлення", orders.length)}
        {card("Затримки", delayed)}
        {card("Блокери", blocked)}
        {card("Очікують закупівлю", waitingPurchase)}
        {card("Готові до монтажу", readyInstall)}
        {card("Сигнали AI", aiRisks.length)}
      </section>
    </div>
  );
}
