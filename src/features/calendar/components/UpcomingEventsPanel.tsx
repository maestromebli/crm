import type React from "react";
import type { CalendarEvent } from "../types";
import { CalendarEventCard } from "./CalendarEventCard";

type UpcomingEventsPanelProps = {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
};

export function UpcomingEventsPanel({
  events,
  onSelectEvent,
}: UpcomingEventsPanelProps) {
  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.startAt).getTime() -
      new Date(b.startAt).getTime(),
  );

  const limited = sorted.slice(0, 6);

  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-3 text-xs shadow-[0_2px_12px_rgba(15,23,42,0.06)] md:p-4">
      <div>
        <p className="text-xs font-semibold text-[var(--enver-text)]">
          Найближчі події
        </p>
        <p className="text-[11px] text-slate-500">
          Сьогодні, завтра та ключові події тижня.
        </p>
      </div>

      {limited.length === 0 ? (
        <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500">
          Календар порожній. Почніть з{" "}
          <span className="font-medium text-slate-800">
            створення заміру
          </span>{" "}
          або{" "}
          <span className="font-medium text-slate-800">
            планування зустрічі
          </span>
          .
        </div>
      ) : (
        <div className="space-y-2">
          {limited.map((event) => (
            <CalendarEventCard
              key={event.id}
              event={event}
              compact
              onClick={onSelectEvent}
            />
          ))}
        </div>
      )}
    </aside>
  );
}

