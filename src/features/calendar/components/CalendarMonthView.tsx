"use client";

import type React from "react";
import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  format,
} from "date-fns";
import { uk } from "date-fns/locale";
import type { CalendarEvent } from "../types";
import { CalendarEventCard } from "./CalendarEventCard";
import { CALENDAR_EVENT_DRAG_MIME, parseCalendarDragPayload } from "../dnd";
import { isDbCalendarEvent, rescheduleEventOnDay } from "../reschedule-helpers";
import { cn } from "../../../lib/utils";

type CalendarMonthViewProps = {
  date: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  /** Клік по номеру дня — перейти до денного вигляду на цю дату. */
  onNavigateToDay?: (day: Date) => void;
  onEventReschedule?: (
    eventId: string,
    startAt: Date,
    endAt: Date,
  ) => void | Promise<void>;
};

export function CalendarMonthView({
  date,
  events,
  onSelectEvent,
  onNavigateToDay,
  onEventReschedule,
}: CalendarMonthViewProps) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let current = gridStart;
  while (current <= gridEnd) {
    days.push(current);
    current = addDays(current, 1);
  }

  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const handleDrop = async (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    setDragOverKey(null);
    if (!onEventReschedule) return;
    const raw = e.dataTransfer.getData(CALENDAR_EVENT_DRAG_MIME);
    const payload = parseCalendarDragPayload(raw);
    if (!payload) return;
    const { startAt, endAt } = rescheduleEventOnDay(day, payload);
    await onEventReschedule(payload.id, startAt, endAt);
  };

  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-3 shadow-[0_2px_12px_rgba(15,23,42,0.06)] md:p-4">
      <div className="grid grid-cols-7 gap-2 border-b border-[var(--enver-border)] pb-2 text-[11px] text-[var(--enver-muted)]">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((name) => (
          <div
            key={name}
            className="flex items-center justify-center uppercase tracking-[0.16em]"
          >
            {name}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2 text-xs">
        {days.map((day) => {
          const inMonth = isSameMonth(day, date);
          const key = day.toISOString();
          const dayEvents = events.filter((event) =>
            isSameDay(new Date(event.startAt), day),
          );

          return (
            <div
              key={key}
              className={cn(
                "min-h-[110px] rounded-xl border px-1.5 py-1.5 transition-colors",
                inMonth
                  ? "border-[var(--enver-border)] bg-[var(--enver-bg)]"
                  : "border-transparent bg-[var(--enver-bg)] text-[var(--enver-muted)]",
                dragOverKey === key &&
                  onEventReschedule &&
                  inMonth &&
                  "bg-[var(--enver-accent-soft)] ring-2 ring-[#2563EB]/40 ring-offset-1",
              )}
              onDragOver={
                onEventReschedule && inMonth
                  ? (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDragOverKey(key);
                    }
                  : undefined
              }
              onDragLeave={(e) => {
                if (
                  onEventReschedule &&
                  !(e.currentTarget as HTMLElement).contains(
                    e.relatedTarget as Node,
                  )
                ) {
                  setDragOverKey(null);
                }
              }}
              onDrop={
                onEventReschedule && inMonth
                  ? (e) => void handleDrop(e, day)
                  : undefined
              }
            >
              <div className="mb-1 flex items-center justify-between text-[11px]">
                {onNavigateToDay && inMonth ? (
                  <button
                    type="button"
                    onClick={() => onNavigateToDay(day)}
                    className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full text-xs font-medium transition hover:bg-[var(--enver-hover)] ${
                      isSameDay(day, new Date())
                        ? "bg-slate-900 text-slate-50 shadow-sm"
                        : "text-slate-700"
                    }`}
                    title="Відкрити день"
                  >
                    {format(day, "d", { locale: uk })}
                  </button>
                ) : (
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                      isSameDay(day, new Date())
                        ? "bg-slate-900 text-slate-50"
                        : "text-slate-700"
                    }`}
                  >
                    {format(day, "d", { locale: uk })}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map((event) => (
                  <CalendarEventCard
                    key={event.id}
                    event={event}
                    compact
                    draggable={Boolean(onEventReschedule && isDbCalendarEvent(event))}
                    onClick={onSelectEvent}
                  />
                ))}
                {dayEvents.length > 2 && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    +{dayEvents.length - 2} ще
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
