import type React from "react";
import {
  AlertTriangle,
  Clock,
  Phone,
  Ruler,
  CalendarCheck,
  Hammer,
  Cog,
  FileText,
  MessageCircle,
  User,
  Truck,
} from "lucide-react";
import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarEventType,
} from "../types";
import { calendarEventTypeCardClass } from "../event-type-styles";
import {
  CALENDAR_EVENT_DRAG_MIME,
  serializeCalendarDragPayload,
} from "../dnd";

type CalendarEventCardProps = {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (event: CalendarEvent) => void;
  /** Лише для подій з БД; увімкнює перетягування. */
  draggable?: boolean;
};

const typeIconMap: Record<CalendarEventType, React.ElementType> = {
  call: Phone,
  meeting: CalendarCheck,
  measurement: Ruler,
  follow_up: MessageCircle,
  proposal_presentation: FileText,
  contract_signing: FileText,
  handoff: Cog,
  production: Cog,
  installation: Hammer,
  delivery: Truck,
  service: WrenchIcon,
  internal: User,
  reminder: Clock,
};

const statusBadgeClass: Record<CalendarEventStatus, string> = {
  planned: "bg-slate-200/90 text-slate-700",
  confirmed: "bg-sky-200/90 text-sky-900",
  in_progress: "bg-emerald-200/90 text-emerald-900",
  completed: "bg-slate-800 text-slate-50",
  canceled: "bg-slate-200/60 text-slate-500 line-through",
  overdue: "bg-rose-200/90 text-rose-900",
};

function WrenchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M21 7.5a5 5 0 0 1-6.43 4.8l-1.17 1.17 2.12 2.12-1.41 1.41-2.12-2.12-3.89 3.89a1.5 1.5 0 0 1-2.12-2.12l3.89-3.89-2.12-2.12 1.41-1.41 2.12 2.12 1.17-1.17A5 5 0 0 1 21 7.5Z"
        className="fill-current"
      />
    </svg>
  );
}

export function CalendarEventCard({
  event,
  compact,
  onClick,
  draggable = false,
}: CalendarEventCardProps) {
  const Icon = typeIconMap[event.type];
  const typeSurface = calendarEventTypeCardClass[event.type];
  const statusBadge = statusBadgeClass[event.status];

  const containerClasses = compact
    ? "rounded-lg border px-2 py-1 text-[11px]"
    : "rounded-xl border px-2.5 py-1.5 text-xs";

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
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
      onClick={() => onClick?.(event)}
      title={
        draggable
          ? "Перетягніть на інший день або час"
          : undefined
      }
      className={`group flex w-full flex-col items-start gap-0.5 text-left shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md ${containerClasses} ${typeSurface} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex w-full items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/80 text-[9px] text-slate-50">
          <Icon className="h-3 w-3" />
        </span>
        <span className="flex-1 truncate font-medium text-[var(--enver-text)]">
          {event.title}
        </span>
        {!compact ? (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusBadge}`}
          >
            {event.status === "planned"
              ? "План"
              : event.status === "confirmed"
                ? "Ок"
                : event.status === "in_progress"
                  ? "Триває"
                  : event.status === "completed"
                    ? "Готово"
                    : event.status === "canceled"
                      ? "Скас"
                      : "!"}
          </span>
        ) : null}
        {event.isCritical && (
          <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
        )}
      </div>
      <div className="flex w-full items-center gap-1.5 text-[10px] text-slate-700">
        <span className="inline-flex items-center gap-0.5">
          <Clock className="h-3 w-3" />
          <span>
            {new Date(event.startAt).toLocaleTimeString("uk-UA", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </span>
        {event.linkedEntityLabel && (
          <span className="truncate text-slate-500">
            · {event.linkedEntityLabel}
          </span>
        )}
      </div>
    </button>
  );
}

