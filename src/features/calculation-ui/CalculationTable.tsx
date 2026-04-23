"use client";

import { useMemo, useRef, useState } from "react";
import type { ClipboardEventHandler, KeyboardEventHandler } from "react";
import type { CalculationAISuggestion } from "../calculation-ai/calculationAIEngine";
import { CalculationRow } from "./CalculationRow";
import type { CalculationRow as CalculationRowModel } from "./calculationStore";

type Props = {
  rows: CalculationRowModel[];
  warnings: Array<{ rowId?: string; message: string }>;
  suggestions: CalculationAISuggestion[];
  onAddRow: () => void;
  onUpdateRow: (rowId: string, patch: Partial<CalculationRowModel>) => void;
  onDeleteRow: (rowId: string) => void;
  onDuplicateRow: (rowId: string) => void;
  onToggleSelect: (rowId: string) => void;
  onReorderRows: (from: number, to: number) => void;
  onApplySuggestion: (suggestion: CalculationAISuggestion) => void;
  onBulkPaste: (rows: Array<Partial<CalculationRowModel>>) => void;
};

export function CalculationTable({
  rows,
  warnings,
  suggestions,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onDuplicateRow,
  onToggleSelect,
  onReorderRows,
  onApplySuggestion,
  onBulkPaste,
}: Props) {
  const headerCellClassName =
    "whitespace-nowrap border-b border-slate-200 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-700";
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const warningMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const warning of warnings) {
      if (warning.rowId && !map.has(warning.rowId)) {
        map.set(warning.rowId, warning.message);
      }
    }
    return map;
  }, [warnings]);

  const suggestionMap = useMemo(() => {
    const map = new Map<string, CalculationAISuggestion>();
    for (const suggestion of suggestions) {
      if (suggestion.rowId && suggestion.type === "autofill" && !map.has(suggestion.rowId)) {
        map.set(suggestion.rowId, suggestion);
      }
    }
    return map;
  }, [suggestions]);

  const handlePaste: ClipboardEventHandler<HTMLDivElement> = (event) => {
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return;
    const parsed = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name = "", qty = "1", coeff = "1", price = "0"] = line.split("\t");
        return {
          name,
          qty: Number(qty) || 0,
          coeff: Number(coeff) || 1,
          price: Number(price) || 0,
        } as Partial<CalculationRowModel>;
      });
    if (parsed.length > 0) {
      event.preventDefault();
      onBulkPaste(parsed);
    }
  };

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onAddRow();
      return;
    }
    if (event.key === "Tab") {
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      tableRef.current?.querySelector("input")?.focus();
    }
  };

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white shadow-sm"
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">Таблиця розрахунку</h3>
          <p className="text-xs text-slate-500">Enter - новий рядок, Ctrl/Cmd+V - масова вставка з Excel</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          onClick={onAddRow}
        >
          + Додати рядок
        </button>
      </div>
      <div className="max-h-[65vh] overflow-auto">
        <table ref={tableRef} className="w-full min-w-[980px] border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">
            <tr>
              <th className={headerCellClassName}>#</th>
              <th className={headerCellClassName}>Назва позиції</th>
              <th className={headerCellClassName}>Тип</th>
              <th className={`${headerCellClassName} text-right`}>Кількість</th>
              <th className={`${headerCellClassName} text-right`}>Коеф.</th>
              <th className={`${headerCellClassName} text-right`}>Ціна, грн</th>
              <th className={`${headerCellClassName} text-right`}>Сума, грн</th>
              <th className={`${headerCellClassName} text-right`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <CalculationRow
                key={row.id}
                index={index}
                row={row}
                warning={warningMap.get(row.id)}
                onChange={(patch) => onUpdateRow(row.id, patch)}
                onToggleSelect={() => onToggleSelect(row.id)}
                onDelete={() => onDeleteRow(row.id)}
                onDuplicate={() => onDuplicateRow(row.id)}
                onAISuggest={() => {
                  const suggestion = suggestionMap.get(row.id);
                  if (suggestion) onApplySuggestion(suggestion);
                }}
                onConvertType={() => {
                  const order: CalculationRowModel["type"][] = [
                    "material",
                    "fitting",
                    "service",
                    "measurement",
                  ];
                  const currentIndex = order.indexOf(row.type);
                  const next = order[(currentIndex + 1) % order.length];
                  onUpdateRow(row.id, { type: next });
                }}
                onDragStart={() => setDragIndex(index)}
                onDrop={() => {
                  if (dragIndex == null) return;
                  onReorderRows(dragIndex, index);
                  setDragIndex(null);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
