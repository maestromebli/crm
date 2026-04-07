"use client";

import type React from "react";
import { useState } from "react";
import { addHours, format, startOfDay } from "date-fns";
import { uk } from "date-fns/locale";
import type { CalendarEvent } from "../types";
import { CalendarEventCard } from "./CalendarEventCard";
import { CALENDAR_EVENT_DRAG_MIME, parseCalendarDragPayload } from "../dnd";
import {
  isDbCalendarEvent,
  rescheduleEventOnHourSlot,
} from "../reschedule-helpers";
import {
  CALENDAR_DAY_HOUR_COUNT,
  CALENDAR_DAY_START_HOUR,
  CALENDAR_HOUR_PX,
} from "../calendar-constants";
import { cn } from "../../../lib/utils";

type CalendarDayViewProps = {
  date: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onEventReschedule?: (
    eventId: string,
    startAt: Date,
    endAt: Date,
  ) => void | Promise<void>;
};

export function CalendarDayView({
  date,
  events,
  onSelectEvent,
  onEventReschedule,
}: CalendarDayViewProps) {
  const start = startOfDay(date);
  const hours = Array.from({ length: CALENDAR_DAY_HOUR_COUNT }, (_, index) =>
    addHours(start, CALENDAR_DAY_START_HOUR + index),
  );

  const [dragOverHour, setDragOverHour] = useState<number | null>(null);

  const handleDrop = async (e: React.DragEvent, slotHour: number) => {
    e.preventDefault();
    setDragOverHour(null);
    if (!onEventReschedule) return;
    const raw = e.dataTransfer.getData(CALENDAR_EVENT_DRAG_MIME);
    const payload = parseCalendarDragPayload(raw);
    if (!payload) return;
    const { startAt, endAt } = rescheduleEventOnHourSlot(
      date,
      slotHour,
      payload,
    );
    await onEventReschedule(payload.id, startAt, endAt);
  };

  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-3 shadow-[0_2px_12px_rgba(15,23,42,0.06)] md:p-4">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
        <span className="font-medium">
          {format(date, "EEEE, d MMMM", { locale: uk })}
        </span>
        {onEventReschedule ? (
          <span className="text-[11px] text-slate-500">
            Перетягніть подію на інший час
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2 text-[11px]">
        <div className="space-y-0 text-right text-slate-400">
          {hours.map((hour) => (
            <div
              key={hour.toISOString()}
              style={{ height: CALENDAR_HOUR_PX }}
              className="flex items-start justify-end pt-0.5"
            >
              {format(hour, "HH:mm")}
            </div>
          ))}
        </div>
        <div className="relative space-y-0">
          {hours.map((hour) => {
            const slotHour = hour.getHours();
            const slotEvents = events.filter((event) => {
              const startAt = new Date(event.startAt);
              return startAt.getHours() === slotHour;
            });

            return (
              <div
                key={hour.toISOString()}
                style={{ minHeight: CALENDAR_HOUR_PX }}
                className={cn(
                  "border-b border-dashed border-slate-100/90 transition-colors",
                  dragOverHour === slotHour &&
                    onEventReschedule &&
                    "bg-emerald-50/90 ring-2 ring-emerald-400/70 ring-inset",
                )}
                onDragOver={
                  onEventReschedule
                    ? (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDragOverHour(slotHour);
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
                    setDragOverHour(null);
                  }
                }}
                onDrop={
                  onEventReschedule
                    ? (e) => void handleDrop(e, slotHour)
                    : undefined
                }
              >
                <div className="space-y-1 pt-0.5">
                  {slotEvents.map((event) => (
                    <CalendarEventCard
                      key={event.id}
                      event={event}
                      compact
                      draggable={Boolean(
                        onEventReschedule && isDbCalendarEvent(event),
                      )}
                      onClick={onSelectEvent}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
