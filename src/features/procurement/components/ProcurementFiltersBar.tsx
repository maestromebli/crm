import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import {
  PROCUREMENT_ITEM_STATUS_FILTERS,
  PROCUREMENT_REQUEST_STATUS_FILTERS,
} from "../lib/filter-options";

type ProjectOption = { id: string; label: string };

type Props = {
  query: string;
  onQuery: (v: string) => void;
  projectId: string;
  onProjectId: (v: string) => void;
  projectOptions: ProjectOption[];
  itemStatus: string;
  onItemStatus: (v: string) => void;
  requestStatus: string;
  onRequestStatus: (v: string) => void;
  onClear?: () => void;
  hasActiveFilters?: boolean;
};

const selectClass =
  "h-9 max-w-[200px] rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300";

export function ProcurementFiltersBar({
  query,
  onQuery,
  projectId,
  onProjectId,
  projectOptions,
  itemStatus,
  onItemStatus,
  requestStatus,
  onRequestStatus,
  onClear,
  hasActiveFilters,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Пошук: проєкт, позиція, PO, постачальник…"
          className="h-9 max-w-sm text-xs"
        />
        <select className={selectClass} value={projectId} onChange={(e) => onProjectId(e.target.value)}>
          <option value="">Усі проєкти</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={requestStatus}
          onChange={(e) => onRequestStatus(e.target.value)}
          aria-label="Статус заявки"
        >
          <option value="">Усі статуси заявок</option>
          {PROCUREMENT_REQUEST_STATUS_FILTERS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={itemStatus}
          onChange={(e) => onItemStatus(e.target.value)}
          aria-label="Статус позиції"
        >
          <option value="">Усі статуси позицій</option>
          {PROCUREMENT_ITEM_STATUS_FILTERS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {onClear && hasActiveFilters ? (
          <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={onClear}>
            Скинути
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Фільтри відображаються в адресі сторінки — можна скопіювати посилання з поточним виглядом.
      </p>
    </div>
  );
}
