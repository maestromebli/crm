"use client";

import type React from "react";
import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
} from "lucide-react";
import {
  endOfWeek,
  format,
  isSameMonth,
  startOfWeek,
} from "date-fns";
import { uk } from "date-fns/locale";
import type { CalendarView, CalendarFilterState } from "../types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import { CalendarMiniMonthPicker } from "./CalendarMiniMonthPicker";
import { cn } from "../../../lib/utils";

type CalendarToolbarProps = {
  currentDate: Date;
  filters: CalendarFilterState;
  onChangeView: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onPickDate: (d: Date) => void;
  onOpenFilters: () => void;
  onCreateEvent: () => void;
};

function formatToolbarTitle(view: CalendarView, date: Date): string {
  if (view === "day") {
    return format(date, "EEEE, d MMMM yyyy", { locale: uk });
  }
  if (view === "week") {
    const ws = startOfWeek(date, { weekStartsOn: 1 });
    const we = endOfWeek(date, { weekStartsOn: 1 });
    if (isSameMonth(ws, we)) {
      return `${format(ws, "d", { locale: uk })}–${format(we, "d MMMM yyyy", { locale: uk })}`;
    }
    return `${format(ws, "d MMM", { locale: uk })} – ${format(we, "d MMM yyyy", { locale: uk })}`;
  }
  return format(date, "LLLL yyyy", { locale: uk });
}

export function CalendarToolbar({
  currentDate,
  filters,
  onChangeView,
  onPrev,
  onNext,
  onToday,
  onPickDate,
  onOpenFilters,
  onCreateEvent,
}: CalendarToolbarProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const title = formatToolbarTitle(filters.view, currentDate);

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--enver-border)] bg-gradient-to-br from-[var(--enver-card)] via-[var(--enver-card)] to-slate-50/40 px-3 py-2.5 text-xs shadow-[0_2px_16px_rgba(15,23,42,0.06)] md:mb-4 md:px-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToday}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200/90 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-50 shadow-sm shadow-slate-900/30 transition hover:bg-slate-800"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Сьогодні
        </button>
        <div className="inline-flex min-w-0 max-w-full items-center rounded-full border border-[var(--enver-border)] bg-[var(--enver-card)] px-1 py-0.5 text-[var(--enver-text)] shadow-sm shadow-slate-900/5">
          <button
            type="button"
            onClick={onPrev}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-[var(--enver-hover)]"
            aria-label="Назад"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex min-w-0 max-w-[min(100vw-12rem,20rem)] items-center gap-1 rounded-full px-2 py-1 text-left transition hover:bg-[var(--enver-hover)]"
                title="Обрати дату"
              >
                <span className="truncate text-xs font-semibold capitalize leading-tight">
                  {title}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0">
              <CalendarMiniMonthPicker
                anchorDate={currentDate}
                onSelectDay={(d) => {
                  onPickDate(d);
                  setDatePickerOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={onNext}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-[var(--enver-hover)]"
            aria-label="Вперед"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-[var(--enver-border)] bg-[var(--enver-card)] p-0.5 text-[11px] shadow-sm shadow-slate-900/5">
          {(
            [
              { id: "day" as const, label: "День" },
              { id: "week" as const, label: "Тиждень" },
              { id: "month" as const, label: "Місяць" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onChangeView(id)}
              className={cn(
                "px-2.5 py-1 transition first:rounded-l-full last:rounded-r-full",
                filters.view === id
                  ? "bg-slate-900 text-slate-50 shadow-sm"
                  : "text-slate-600 hover:bg-[var(--enver-hover)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--enver-border)] bg-[var(--enver-card)] px-2.5 py-1.5 text-[11px] text-[var(--enver-text)] shadow-sm shadow-slate-900/5 transition hover:bg-[var(--enver-hover)]"
        >
          <Filter className="h-3.5 w-3.5" />
          Фільтри
        </button>

        <button
          type="button"
          onClick={onCreateEvent}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-emerald-50 shadow-sm shadow-emerald-600/40 transition hover:bg-emerald-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Створити подію
        </button>
      </div>
    </div>
  );
}
