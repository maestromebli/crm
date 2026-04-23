"use client";

import type { CalculationRow as CalculationRowModel, CalculationRowType } from "./calculationStore";
import { cn } from "../../lib/utils";

const TYPES: Array<{ value: CalculationRowType; label: string }> = [
  { value: "material", label: "Матеріал" },
  { value: "fitting", label: "Фурнітура" },
  { value: "service", label: "Послуга" },
  { value: "measurement", label: "Замір" },
];

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const cellCls = "px-2 py-2 align-top text-sm text-slate-700";

type Props = {
  index: number;
  row: CalculationRowModel;
  warning?: string;
  onChange: (patch: Partial<CalculationRowModel>) => void;
  onToggleSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAISuggest: () => void;
  onConvertType: () => void;
  onDragStart: () => void;
  onDrop: () => void;
};

export function CalculationRow({
  index,
  row,
  warning,
  onChange,
  onToggleSelect,
  onDuplicate,
  onDelete,
  onAISuggest,
  onConvertType,
  onDragStart,
  onDrop,
}: Props) {
  return (
    <tr
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "group border-b border-slate-200/90 transition hover:bg-slate-50",
        row.selected ? "bg-blue-50/80 ring-1 ring-inset ring-blue-200" : index % 2 === 0 ? "bg-white" : "bg-slate-50/40",
      )}
    >
      <td className={cellCls}>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-xs hover:bg-white"
          onClick={onToggleSelect}
        >
          {row.selected ? "✓" : index + 1}
        </button>
      </td>
      <td className={cellCls}>
        <input
          className={inputCls}
          value={row.name}
          placeholder="Назва позиції"
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {warning ? <p className="mt-1 text-xs text-amber-700">{warning}</p> : null}
      </td>
      <td className={cellCls}>
        <select
          className={inputCls}
          value={row.type}
          onChange={(e) => onChange({ type: e.target.value as CalculationRowType })}
        >
          {TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td className={cellCls}>
        <input
          type="number"
          className={`${inputCls} text-right tabular-nums`}
          value={row.qty}
          onChange={(e) => onChange({ qty: Number(e.target.value) || 0 })}
        />
      </td>
      <td className={cellCls}>
        <input
          type="number"
          step="0.01"
          className={`${inputCls} text-right tabular-nums`}
          value={row.coeff}
          onChange={(e) => onChange({ coeff: Number(e.target.value) || 0 })}
        />
      </td>
      <td className={cellCls}>
        <input
          type="number"
          className={`${inputCls} text-right tabular-nums`}
          value={row.price}
          onChange={(e) => onChange({ price: Number(e.target.value) || 0 })}
        />
      </td>
      <td className={`${cellCls} text-right font-semibold tabular-nums text-slate-900`}>
        {row.amount.toLocaleString("uk-UA", { maximumFractionDigits: 2 })} ₴
      </td>
      <td className={cellCls}>
        <div className="flex items-center justify-end gap-1 opacity-60 transition group-hover:opacity-100">
          <button type="button" className="rounded-md px-2 py-1 text-xs hover:bg-slate-100" onClick={onDuplicate}>
            Дубль
          </button>
          <button type="button" className="rounded-md px-2 py-1 text-xs hover:bg-slate-100" onClick={onAISuggest}>
            AI
          </button>
          <button type="button" className="rounded-md px-2 py-1 text-xs hover:bg-slate-100" onClick={onConvertType}>
            Тип
          </button>
          <button type="button" className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50" onClick={onDelete}>
            Видалити
          </button>
        </div>
      </td>
    </tr>
  );
}
