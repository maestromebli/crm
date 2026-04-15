"use client";

import type { ImportedBlock } from "../types/calculationImport.types";
import { ImportWarnings } from "./ImportWarnings";

function confidenceFromWarnings(block: ImportedBlock): number {
  if (typeof block.confidence === "number" && Number.isFinite(block.confidence)) {
    return Math.max(0, Math.min(100, Math.round(block.confidence)));
  }
  const penalty = Math.min(60, block.warnings.length * 12);
  return Math.max(40, 100 - penalty);
}

function parseMaybeNumber(v: string): number | null {
  const value = v.trim();
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function ProductBlockPreview({
  block,
  editable,
  onChange,
  onDelete,
}: {
  block: ImportedBlock;
  editable: boolean;
  onChange: (next: ImportedBlock) => void;
  onDelete: () => void;
}) {
  const confidence = confidenceFromWarnings(block);
  const subtotalCalculated = block.items.reduce(
    (acc, row) => acc + (row.amount ?? 0),
    0,
  );
  const extrasCalculated = block.extras.reduce((acc, r) => acc + (r.amount ?? 0), 0);
  const finalCalculated = subtotalCalculated + extrasCalculated;

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Product: {block.productName}
          </p>
          <p className="text-xs text-slate-500">Confidence: {confidence}%</p>
          {editable ? (
            <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
              <span>Manual confidence</span>
              <input
                type="range"
                min={0}
                max={100}
                value={confidence}
                onChange={(e) => {
                  onChange({ ...block, confidence: Number(e.target.value) });
                }}
              />
              <input
                className="w-14 rounded border border-slate-200 px-1 py-0.5 text-right"
                value={String(confidence)}
                onChange={(e) => {
                  const parsed = parseMaybeNumber(e.target.value);
                  if (parsed == null) return;
                  onChange({ ...block, confidence: parsed });
                }}
              />
            </label>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700"
          onClick={onDelete}
        >
          Видалити блок
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-100">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-2 py-1">Назва</th>
              <th className="px-2 py-1">Тип</th>
              <th className="px-2 py-1">Кіль</th>
              <th className="px-2 py-1">Коеф</th>
              <th className="px-2 py-1">Ціна</th>
              <th className="px-2 py-1">Сума</th>
            </tr>
          </thead>
          <tbody>
            {block.items.map((row, idx) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-2 py-1">
                  {editable ? (
                    <input
                      className="w-full rounded border border-slate-200 px-1 py-0.5"
                      value={row.name}
                      onChange={(e) => {
                        const next = { ...block, items: [...block.items] };
                        next.items[idx] = { ...next.items[idx], name: e.target.value };
                        onChange(next);
                      }}
                    />
                  ) : (
                    row.name
                  )}
                </td>
                <td className="px-2 py-1">{row.type}</td>
                <td className="px-2 py-1">
                  {editable ? (
                    <input
                      className="w-20 rounded border border-slate-200 px-1 py-0.5"
                      value={row.qty ?? ""}
                      onChange={(e) => {
                        const next = { ...block, items: [...block.items] };
                        next.items[idx] = {
                          ...next.items[idx],
                          qty: parseMaybeNumber(e.target.value),
                        };
                        onChange(next);
                      }}
                    />
                  ) : (
                    row.qty ?? "—"
                  )}
                </td>
                <td className="px-2 py-1">
                  {editable ? (
                    <input
                      className="w-20 rounded border border-slate-200 px-1 py-0.5"
                      value={row.coeff ?? ""}
                      onChange={(e) => {
                        const next = { ...block, items: [...block.items] };
                        next.items[idx] = {
                          ...next.items[idx],
                          coeff: parseMaybeNumber(e.target.value),
                        };
                        onChange(next);
                      }}
                    />
                  ) : (
                    row.coeff ?? "—"
                  )}
                </td>
                <td className="px-2 py-1">
                  {editable ? (
                    <input
                      className="w-24 rounded border border-slate-200 px-1 py-0.5"
                      value={row.price ?? ""}
                      onChange={(e) => {
                        const next = { ...block, items: [...block.items] };
                        next.items[idx] = {
                          ...next.items[idx],
                          price: parseMaybeNumber(e.target.value),
                        };
                        onChange(next);
                      }}
                    />
                  ) : (
                    row.price ?? "—"
                  )}
                </td>
                <td className="px-2 py-1">
                  {editable ? (
                    <input
                      className="w-24 rounded border border-slate-200 px-1 py-0.5"
                      value={row.amount ?? ""}
                      onChange={(e) => {
                        const next = { ...block, items: [...block.items] };
                        next.items[idx] = {
                          ...next.items[idx],
                          amount: parseMaybeNumber(e.target.value),
                        };
                        onChange(next);
                      }}
                    />
                  ) : (
                    row.amount ?? "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-1 text-xs text-slate-700 sm:grid-cols-3">
        <p>Собівартість: {block.subtotal?.amount ?? subtotalCalculated}</p>
        <p>Замір: {extrasCalculated || "—"}</p>
        <p>Вартість: {block.finalTotal?.amount ?? finalCalculated}</p>
      </div>

      <ImportWarnings warnings={block.warnings} />
    </div>
  );
}
