"use client";

import type React from "react";
import { useEffect, useState } from "react";
import {
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  addDays,
  endOfWeek,
} from "date-fns";
import { uk } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../../lib/utils";

type CalendarMiniMonthPickerProps = {
  anchorDate: Date;
  onSelectDay: (day: Date) => void;
};

export function CalendarMiniMonthPicker({
  anchorDate,
  onSelectDay,
}: CalendarMiniMonthPickerProps) {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(anchorDate),
  );

  useEffect(() => {
    setVisibleMonth(startOfMonth(anchorDate));
  }, [anchorDate]);

  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let cur = gridStart;
  while (cur <= gridEnd) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  return (
    <div className="w-[min(100vw-2rem,280px)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-[var(--enver-hover)]"
          onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
          aria-label="Попередній місяць"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold capitalize text-[var(--enver-text)]">
          {format(visibleMonth, "LLLL yyyy", { locale: uk })}
        </span>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-[var(--enver-hover)]"
          onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
          aria-label="Наступний місяць"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-[var(--enver-muted)]">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const inMonth = isSameMonth(day, visibleMonth);
          const today = isSameDay(day, new Date());
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => {
                onSelectDay(day);
                if (!isSameMonth(day, visibleMonth)) {
                  setVisibleMonth(startOfMonth(day));
                }
              }}
              className={cn(
                "flex h-8 items-center justify-center rounded-lg text-xs font-medium transition",
                !inMonth && "text-slate-400 hover:bg-slate-100/80",
                inMonth && !today && "text-slate-700 hover:bg-[var(--enver-hover)]",
                today &&
                  "bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20",
                inMonth &&
                  isSameDay(day, anchorDate) &&
                  !today &&
                  "bg-[var(--enver-accent-soft)] text-[var(--enver-text)] ring-1 ring-[var(--enver-border)]",
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
