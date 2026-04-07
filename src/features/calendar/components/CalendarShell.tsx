"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CalendarEvent,
  CalendarFilterState,
  CalendarView,
} from "../types";
import type { CalendarRoutePreset } from "../route-presets";
import { initialFiltersForCalendarPreset } from "../route-presets";
import { CalendarToolbar } from "./CalendarToolbar";
import { CalendarWeekView } from "./CalendarWeekView";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarDayView } from "./CalendarDayView";
import { CalendarFilters } from "./CalendarFilters";
import { EventDetailsPanel } from "./EventDetailsPanel";
import { UpcomingEventsPanel } from "./UpcomingEventsPanel";
import { CreateEventDialog } from "./CreateEventDialog";

type CalendarShellProps = {
  initialDate?: Date;
  events: CalendarEvent[];
  /** Для фільтра «Лише мої» (id з сесії). */
  currentUserId?: string | null;
  /** Відповідає підмаршруту /calendar/... з навігації */
  routePreset?: CalendarRoutePreset;
};

const defaultFilters: CalendarFilterState = {
  view: "week",
  onlyMine: false,
  onlyCritical: false,
  onlyOverdue: false,
  types: null,
  statuses: null,
};

function isEventMine(event: CalendarEvent, userId: string): boolean {
  if (event.createdById === userId) return true;
  if (event.assignedToId != null && event.assignedToId === userId) return true;
  return false;
}

export function CalendarShell({
  initialDate,
  events,
  currentUserId = null,
  routePreset,
}: CalendarShellProps) {
  const router = useRouter();
  const [date, setDate] = useState<Date>(initialDate ?? new Date());
  const [filters, setFilters] = useState<CalendarFilterState>(() =>
    routePreset != null
      ? initialFiltersForCalendarPreset(routePreset)
      : defaultFilters,
  );
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filters.types?.length && !filters.types.includes(event.type)) {
        return false;
      }
      if (
        filters.statuses?.length &&
        !filters.statuses.includes(event.status)
      ) {
        return false;
      }
      if (filters.onlyMine && currentUserId) {
        if (!isEventMine(event, currentUserId)) {
          return false;
        }
      }
      if (filters.onlyCritical && !event.isCritical) {
        return false;
      }
      if (filters.onlyOverdue && event.status !== "overdue") {
        return false;
      }
      return true;
    });
  }, [
    currentUserId,
    events,
    filters.onlyCritical,
    filters.onlyMine,
    filters.onlyOverdue,
    filters.statuses,
    filters.types,
  ]);

  const handleChangeView = (view: CalendarView) => {
    setFilters((prev) => ({ ...prev, view }));
  };

  const handlePrev = useCallback(() => {
    setDate((d) => {
      const next = new Date(d);
      if (filters.view === "month") {
        next.setMonth(d.getMonth() - 1);
      } else if (filters.view === "week") {
        next.setDate(d.getDate() - 7);
      } else {
        next.setDate(d.getDate() - 1);
      }
      return next;
    });
  }, [filters.view]);

  const handleNext = useCallback(() => {
    setDate((d) => {
      const next = new Date(d);
      if (filters.view === "month") {
        next.setMonth(d.getMonth() + 1);
      } else if (filters.view === "week") {
        next.setDate(d.getDate() + 7);
      } else {
        next.setDate(d.getDate() + 1);
      }
      return next;
    });
  }, [filters.view]);

  const handleToday = useCallback(() => {
    setDate(new Date());
  }, []);

  const handlePickDate = useCallback((d: Date) => {
    setDate(d);
  }, []);

  const handleNavigateToDayFromMonth = useCallback((d: Date) => {
    setDate(d);
    setFilters((prev) => ({ ...prev, view: "day" }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        handleToday();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNext, handlePrev, handleToday]);

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setDetailsOpen(true);
  };

  const handleEventReschedule = useCallback(
    async (eventId: string, startAt: Date, endAt: Date) => {
      try {
        const r = await fetch(`/api/calendar/events/${eventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
          }),
        });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) {
          window.alert(j.error ?? "Не вдалося перенести подію");
          return;
        }
        router.refresh();
      } catch {
        window.alert("Помилка мережі");
      }
    },
    [router],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col gap-3">
        <CalendarToolbar
          currentDate={date}
          filters={filters}
          onChangeView={handleChangeView}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          onPickDate={handlePickDate}
          onOpenFilters={() => setFiltersOpen(true)}
          onCreateEvent={() => setCreateOpen(true)}
        />

        {filters.view === "month" && (
          <CalendarMonthView
            date={date}
            events={filteredEvents}
            onSelectEvent={handleSelectEvent}
            onEventReschedule={handleEventReschedule}
            onNavigateToDay={handleNavigateToDayFromMonth}
          />
        )}
        {filters.view === "week" && (
          <CalendarWeekView
            date={date}
            events={filteredEvents}
            onSelectEvent={handleSelectEvent}
            onEventReschedule={handleEventReschedule}
          />
        )}
        {filters.view === "day" && (
          <CalendarDayView
            date={date}
            events={filteredEvents}
            onSelectEvent={handleSelectEvent}
            onEventReschedule={handleEventReschedule}
          />
        )}
      </div>

      <div className="flex flex-col gap-3">
        <UpcomingEventsPanel
          events={filteredEvents}
          onSelectEvent={handleSelectEvent}
        />
      </div>

      <CalendarFilters
        open={filtersOpen}
        filters={filters}
        onClose={() => setFiltersOpen(false)}
        onChange={setFilters}
      />

      <CreateEventDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        anchorDate={date}
      />

      <EventDetailsPanel
        event={selectedEvent}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
      />
    </div>
  );
}
