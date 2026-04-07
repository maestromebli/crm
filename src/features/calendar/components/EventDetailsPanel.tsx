import type React from "react";
import { X, ExternalLink } from "lucide-react";
import type { CalendarEvent } from "../types";
import {
  calendarEventStatusLabel,
  calendarEventTypeLabel,
} from "../calendar-labels";
import { calendarEventTypePillClass } from "../event-type-styles";
import { EventDetailsShare } from "./EventDetailsShare";

type EventDetailsPanelProps = {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
};

export function EventDetailsPanel({
  event,
  open,
  onClose,
}: EventDetailsPanelProps) {
  if (!open || !event) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-slate-200 bg-[var(--enver-card)]/95 p-4 text-xs shadow-[0_22px_60px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[var(--enver-text)]">
            {event.title}
          </p>
          <p className="text-[11px] text-slate-500">
            {new Date(event.startAt).toLocaleString("uk-UA", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            ·{" "}
            {new Date(event.endAt).toLocaleTimeString(
              "uk-UA",
              {
                hour: "2-digit",
                minute: "2-digit",
              },
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 bg-[var(--enver-card)] p-1 text-slate-500 shadow-sm hover:bg-[var(--enver-hover)] hover:text-[var(--enver-text)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="flex items-center justify-between text-[11px] text-slate-600">
          <span>Тип події</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] ${calendarEventTypePillClass[event.type]}`}
          >
            {calendarEventTypeLabel[event.type]}
          </span>
        </div>

        {event.status && (
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>Статус</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] text-slate-700">
              {calendarEventStatusLabel[event.status]}
            </span>
          </div>
        )}

        {event.assigneeName && (
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>Відповідальний</span>
            <span className="font-medium text-slate-800">
              {event.assigneeName}
            </span>
          </div>
        )}

        {event.location && (
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>Локація</span>
            <span className="font-medium text-slate-800">
              {event.location}
            </span>
          </div>
        )}

        {event.linkedEntityLabel && (
          <button
            type="button"
            className="mt-1 inline-flex w-full items-center justify-between rounded-xl border border-slate-200 bg-[var(--enver-card)] px-2.5 py-1.5 text-[11px] text-slate-700 shadow-sm hover:bg-[var(--enver-hover)]"
          >
            <span className="flex flex-col items-start">
              <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Повʼязана сутність
              </span>
              <span className="font-medium">
                {event.linkedEntityLabel}
              </span>
            </span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {event.notes && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2.5 text-[11px] text-slate-700">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
            Нотатки
          </p>
          <p>{event.notes}</p>
        </div>
      )}

      <EventDetailsShare event={event} />
    </aside>
  );
}

