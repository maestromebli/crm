"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { startOfWeek, addDays, format, isSameDay } from "date-fns";
import { uk } from "date-fns/locale";
import type { CalendarEvent } from "../types";
import { CALENDAR_DAY_HOUR_COUNT, CALENDAR_DAY_START_HOUR, CALENDAR_HOUR_PX } from "../calendar-constants";
import { calendarEventTypeCardClass } from "../event-type-styles";
import {
  CALENDAR_EVENT_DRAG_MIME,
  parseCalendarDragPayload,
  serializeCalendarDragPayload,
} from "../dnd";
import {
  isDbCalendarEvent,
  rescheduleEventAt,
} from "../reschedule-helpers";
import { assignEventColumns, eventPercentInDayGrid } from "../week-layout";
import { cn } from "../../../lib/utils";

type CalendarWeekViewProps = {
  date: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onEventReschedule?: (
    eventId: string,
    startAt: Date,
    endAt: Date,
  ) => void | Promise<void>;
};

const GRID_HEIGHT = CALENDAR_DAY_HOUR_COUNT * CALENDAR_HOUR_PX;

function snapDropTime(
  frac: number,
): { hour: number; minute: number } {
  const spanMin = CALENDAR_DAY_HOUR_COUNT * 60;
  const minsFromGridStart = frac * spanMin;
  const startMin =
    CALENDAR_DAY_START_HOUR * 60 + minsFromGridStart;
  let h = Math.floor(startMin / 60);
  let m = Math.floor(startMin % 60);
  m = Math.round(m / 15) * 15;
  if (m >= 60) {
    h += 1;
    m = 0;
  }
  const maxH = CALENDAR_DAY_START_HOUR + CALENDAR_DAY_HOUR_COUNT - 1;
  h = Math.min(Math.max(h, CALENDAR_DAY_START_HOUR), maxH);
  return { hour: h, minute: m };
}

export function CalendarWeekView({
  date,
  events,
  onSelectEvent,
  onEventReschedule,
}: CalendarWeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );

  const byDay = days.map((day) => ({
    day,
    key: day.toISOString(),
    events: events.filter((event) =>
      isSameDay(new Date(event.startAt), day),
    ),
  }));

  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const now = new Date();
    const h = now.getHours();
    if (
      h < CALENDAR_DAY_START_HOUR ||
      h >= CALENDAR_DAY_START_HOUR + CALENDAR_DAY_HOUR_COUNT
    ) {
      return;
    }
    const idx = h - CALENDAR_DAY_START_HOUR;
    requestAnimationFrame(() => {
      el.scrollTop = Math.max(0, idx * CALENDAR_HOUR_PX - 48);
    });
  }, [date]);

  const handleDrop = async (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    setDragOverKey(null);
    if (!onEventReschedule) return;
    const raw = e.dataTransfer.getData(CALENDAR_EVENT_DRAG_MIME);
    const payload = parseCalendarDragPayload(raw);
    if (!payload) return;
    const col = e.currentTarget as HTMLElement;
    const rect = col.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const frac = Math.min(1, Math.max(0, y / rect.height));
    const { hour, minute } = snapDropTime(frac);
    const { startAt, endAt } = rescheduleEventAt(day, hour, minute, payload);
    await onEventReschedule(payload.id, startAt, endAt);
  };

  const now = new Date();

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)]">
      <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] border-b border-[var(--enver-border)] bg-[var(--enver-surface)] text-[11px]">
        <div className="p-2" aria-hidden />
        {byDay.map(({ day }) => (
          <div
            key={day.toISOString()}
            className="flex flex-col items-center gap-0.5 border-l border-[var(--enver-border)]/80 py-2"
          >
            <span className="uppercase tracking-[0.14em] text-[var(--enver-muted)]">
              {format(day, "EEE", { locale: uk })}
            </span>
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                isSameDay(day, new Date())
                  ? "bg-[var(--enver-accent)] text-white"
                  : "text-[var(--enver-text)]",
              )}
            >
              {format(day, "d", { locale: uk })}
            </span>
          </div>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="max-h-[min(72vh,640px)] overflow-y-auto overflow-x-hidden"
      >
        <div
          className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))]"
          style={{ minHeight: GRID_HEIGHT }}
        >
          <div className="relative border-r border-[var(--enver-border)] bg-[var(--enver-bg)]/50 text-[10px] text-[var(--enver-muted)]">
            {Array.from({ length: CALENDAR_DAY_HOUR_COUNT }, (_, i) => (
              <div
                key={i}
                className="flex justify-end pr-2 pt-0.5"
                style={{ height: CALENDAR_HOUR_PX }}
              >
                {String(CALENDAR_DAY_START_HOUR + i).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {byDay.map(({ day, key, events: dayEvents }) => {
            const visibleForLayout = dayEvents.filter(
              (ev) =>
                eventPercentInDayGrid(
                  ev,
                  day,
                  CALENDAR_DAY_START_HOUR,
                  CALENDAR_DAY_HOUR_COUNT,
                ) != null,
            );
            const layout = assignEventColumns(visibleForLayout);
            const showNowLine =
              isSameDay(day, now) &&
              now.getHours() >= CALENDAR_DAY_START_HOUR &&
              now.getHours() <
                CALENDAR_DAY_START_HOUR + CALENDAR_DAY_HOUR_COUNT;
            let nowTop: number | null = null;
            if (showNowLine) {
              const gridStartMin = CALENDAR_DAY_START_HOUR * 60;
              const gridEndMin =
                (CALENDAR_DAY_START_HOUR + CALENDAR_DAY_HOUR_COUNT) * 60;
              const nowMin = now.getHours() * 60 + now.getMinutes();
              nowTop =
                ((nowMin - gridStartMin) / (gridEndMin - gridStartMin)) * 100;
            }

            return (
              <div
                key={key}
                className={cn(
                  "relative border-l border-[var(--enver-border)]/70 bg-[var(--enver-bg)]/22",
                  dragOverKey === key &&
                    onEventReschedule &&
                    "bg-[var(--enver-accent-soft)]/50 ring-inset ring-2 ring-[var(--enver-accent)]/30",
                )}
                style={{ minHeight: GRID_HEIGHT }}
                onDragOver={
                  onEventReschedule
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
                  onEventReschedule
                    ? (e) => void handleDrop(e, day)
                    : undefined
                }
              >
                {Array.from({ length: CALENDAR_DAY_HOUR_COUNT }, (_, i) => (
                  <div
                    key={i}
                    className="pointer-events-none border-b border-dashed border-[var(--enver-border)]/70"
                    style={{ height: CALENDAR_HOUR_PX }}
                  />
                ))}

                {nowTop != null && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-rose-500/90"
                    style={{ top: `${nowTop}%` }}
                    title="Зараз"
                  />
                )}

                <div className="pointer-events-none absolute inset-0">
                  {dayEvents.map((event) => {
                    const pos = eventPercentInDayGrid(
                      event,
                      day,
                      CALENDAR_DAY_START_HOUR,
                      CALENDAR_DAY_HOUR_COUNT,
                    );
                    if (!pos) return null;
                    const lane = layout.get(event.id);
                    if (!lane) return null;
                    const { col, cols } = lane;
                    const w = 100 / cols;
                    const left = col * w;
                    const draggable =
                      Boolean(onEventReschedule) && isDbCalendarEvent(event);
                    return (
                      <button
                        key={event.id}
                        type="button"
                        draggable={draggable}
                        onDragStart={
                          draggable
                            ? (e) => {
                                e.stopPropagation();
                                e.dataTransfer.setData(
                                  CALENDAR_EVENT_DRAG_MIME,
                                  serializeCalendarDragPayload({
                                    id: event.id,
                                    startAt: event.startAt,
                                    endAt: event.endAt,
                                  }),
                                );
                                e.dataTransfer.effectAllowed = "move";
                              }
                            : undefined
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(event);
                        }}
                        style={{
                          top: `${pos.top}%`,
                          height: `${pos.height}%`,
                          left: `calc(${left}% + 2px)`,
                          width: `calc(${w}% - 4px)`,
                        }}
                        className={cn(
                          "pointer-events-auto absolute z-10 flex flex-col overflow-hidden rounded-lg border px-1 py-0.5 text-left text-[10px] shadow-sm transition hover:z-20 hover:brightness-[1.02]",
                          calendarEventTypeCardClass[event.type],
                          draggable && "cursor-grab active:cursor-grabbing",
                        )}
                        title={event.title}
                      >
                        <span className="truncate font-semibold leading-tight text-[var(--enver-text)]">
                          {event.title}
                        </span>
                        <span className="mt-auto inline-flex items-center gap-0.5 text-[9px] text-slate-600">
                          <Clock className="h-2.5 w-2.5 shrink-0" />
                          {new Date(event.startAt).toLocaleTimeString("uk-UA", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {onEventReschedule ? (
        <p className="border-t border-[var(--enver-border)] bg-slate-50/50 px-3 py-1.5 text-[10px] text-[var(--enver-muted)]">
          Перетягніть подію на потрібний день і час. Час підлаштовується по сітці 15 хв.
        </p>
      ) : null}
    </div>
  );
}
