import type React from "react";
import type { CalendarFilterState } from "../types";

type CalendarFiltersProps = {
  open: boolean;
  filters: CalendarFilterState;
  onClose: () => void;
  onChange: (next: CalendarFilterState) => void;
};

export function CalendarFilters({
  open,
  filters,
  onClose,
  onChange,
}: CalendarFiltersProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/20 px-3 py-16 md:px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-[var(--enver-card)]/95 p-4 text-xs shadow-[0_22px_60px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--enver-text)]">
              Фільтри календаря
            </p>
            <p className="text-[11px] text-slate-500">
              Налаштуйте відображення подій.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-slate-500 hover:text-[var(--enver-text)]"
          >
            Закрити
          </button>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-700">
            <span className="pr-2">
              Лише мої події
              <span className="mt-0.5 block font-normal text-[10px] text-slate-500">
                За автором або виконавцем у БД; демо-події без привʼязки не
                показуються.
              </span>
            </span>
            <input
              type="checkbox"
              className="shrink-0"
              checked={filters.onlyMine}
              onChange={(event) =>
                onChange({
                  ...filters,
                  onlyMine: event.target.checked,
                })
              }
            />
          </label>

          <label className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-700">
            <span>Тільки критичні</span>
            <input
              type="checkbox"
              checked={filters.onlyCritical}
              onChange={(event) =>
                onChange({
                  ...filters,
                  onlyCritical: event.target.checked,
                })
              }
            />
          </label>

          <label className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-700">
            <span>Тільки прострочені</span>
            <input
              type="checkbox"
              checked={filters.onlyOverdue}
              onChange={(event) =>
                onChange({
                  ...filters,
                  onlyOverdue: event.target.checked,
                })
              }
            />
          </label>

          <p className="text-[11px] text-slate-500">
            Детальні фільтри за типом подій, статусами та
            виконавцями можна буде розширити при підключенні
            реальних даних.
          </p>
        </div>
      </div>
    </div>
  );
}

