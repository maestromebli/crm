"use client";

import { Clock3 } from "lucide-react";
import type { ConstructorTimelineEvent } from "../constructor-hub.types";

export function ConstructorTimeline({ events }: { events: ConstructorTimelineEvent[] }) {
  return (
    <section id="history" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Історія</h3>
      {events.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">
          Події зʼявляться після перших дій у проєкті.
        </div>
      ) : (
        <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">
          {events.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border border-slate-300 bg-white" />
              <p className="text-sm font-medium text-slate-900">{event.title}</p>
              <p className="text-xs text-slate-600">{event.description}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Clock3 className="h-3.5 w-3.5" />
                {event.actorName} · {new Date(event.createdAt).toLocaleString("uk-UA")}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
