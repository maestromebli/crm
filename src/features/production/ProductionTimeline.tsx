import type { OpsTimelineEvent } from "./types/operations-core";

export function ProductionTimeline({ events }: { events: OpsTimelineEvent[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>
      <ul className="mt-3 space-y-2">
        {events.map((event) => (
          <li key={event.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
            <p className="font-medium text-slate-900">{event.title}</p>
            <p className="text-slate-600">{event.description ?? "Без деталей"}</p>
            <p className="text-slate-500">{event.at}{event.actor ? ` · ${event.actor}` : ""}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
