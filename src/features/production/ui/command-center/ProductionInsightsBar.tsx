type Insights = {
  criticalOverdue: number;
  blockedOrders: number;
  overloadedWorkshops: number;
  idleCapacity: number;
  replanCandidates: number;
  todayStarts: number;
  todayFinishes: number;
};

export function ProductionInsightsBar({ insights }: { insights: Insights }) {
  const cards = [
    { id: "overdue", label: "Прострочені замовлення", value: insights.criticalOverdue, tone: insights.criticalOverdue > 0 ? "danger" : "ok" },
    {
      id: "overload",
      label: "Попередження перевантаження",
      value: insights.overloadedWorkshops,
      tone: insights.overloadedWorkshops > 0 ? "danger" : "ok",
    },
    { id: "blocked", label: "Заблоковані замовлення", value: insights.blockedOrders, tone: insights.blockedOrders > 0 ? "warning" : "ok" },
    { id: "idle", label: "Вільна потужність", value: insights.idleCapacity, tone: "neutral" },
    { id: "replan", label: "Потребують перепланування", value: insights.replanCandidates, tone: insights.replanCandidates > 0 ? "warning" : "ok" },
    { id: "today", label: "Старт / фініш сьогодні", value: `${insights.todayStarts}/${insights.todayFinishes}`, tone: "neutral" },
  ] as const;

  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <div key={card.id} className={`rounded-xl border px-3 py-2 ${getToneClass(card.tone)}`}>
          <p className="text-[11px] uppercase tracking-wide">{card.label}</p>
          <p className="mt-1 text-lg font-semibold">{card.value}</p>
        </div>
      ))}
    </section>
  );
}

function getToneClass(tone: "danger" | "warning" | "neutral" | "ok") {
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-900";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  if (tone === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  return "border-slate-200 bg-slate-50 text-slate-800";
}
