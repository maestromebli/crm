import { OperationsEventDrawer, type OperationsEvent } from "./OperationsEventDrawer";
import { OperationsFilters } from "./OperationsFilters";

export function OperationsCalendarPage({ events }: { events: OperationsEvent[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = events.filter((e) => e.date < today);

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Operations Calendar</h1>
        <p className="text-sm text-slate-600">Day / Week / Month для замірів, дедлайнів конструктора, цеху, поставок і монтажу.</p>
      </header>
      <OperationsFilters
        state={{
          measurements: true,
          constructorDeadlines: true,
          productionMilestones: true,
          purchaseDeliveries: true,
          installations: true,
        }}
      />
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Події</h3>
          <ul className="mt-3 space-y-2 text-xs">
            {events.map((event) => (
              <li key={event.id} className={`rounded-lg border px-3 py-2 ${event.date < today ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}>
                <p className="font-medium text-slate-900">{event.title}</p>
                <p className="text-slate-600">{event.orderName}</p>
                <p className="text-slate-500">{event.date} · {event.type}</p>
              </li>
            ))}
          </ul>
          {overdue.length > 0 ? <p className="mt-2 text-xs text-rose-700">Overdue подій: {overdue.length}</p> : null}
        </section>
        <OperationsEventDrawer event={events[0] ?? null} />
      </div>
    </div>
  );
}
