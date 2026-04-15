"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  BREAKDOWN_KIND_LABELS,
  type BreakdownComponent,
  type BreakdownComponentKind,
  type EstimateLineBreakdownMeta,
  emptyBreakdown,
  parseEstimateLineBreakdown,
  recomputeLineTotalsFromBreakdown,
} from "../../../lib/estimates/estimate-line-breakdown";
import { cn } from "../../../lib/utils";

const KINDS: BreakdownComponentKind[] = [
  "material",
  "hardware",
  "service",
  "other",
];

const uid = () => `c_${Math.random().toString(36).slice(2, 11)}`;

type Props = {
  lineQty: number;
  value: EstimateLineBreakdownMeta | null;
  disabled: boolean;
  showCostFields: boolean;
  onChange: (next: EstimateLineBreakdownMeta | null) => void;
  onApplyTotals: (totals: {
    amountSale: number;
    amountCost: number | null;
    salePrice: number;
    costPrice: number | null;
  }) => void;
};

function ensureMeta(
  v: EstimateLineBreakdownMeta | null,
): EstimateLineBreakdownMeta {
  return parseEstimateLineBreakdown(v) ?? emptyBreakdown();
}

export function LineBreakdownEditor({
  lineQty,
  value,
  disabled,
  showCostFields,
  onChange,
  onApplyTotals,
}: Props) {
  const meta = ensureMeta(value);

  const updateComponent = (id: string, patch: Partial<BreakdownComponent>) => {
    onChange({
      ...meta,
      components: meta.components.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    });
  };

  const addRow = () => {
    onChange({
      ...meta,
      components: [
        ...meta.components,
        {
          id: uid(),
          kind: "material",
          name: "",
          qty: 1,
          unit: "шт",
          unitCost: null,
          unitSale: null,
        },
      ],
    });
  };

  const removeRow = (id: string) => {
    const next = meta.components.filter((c) => c.id !== id);
    onChange(next.length === 0 ? null : { ...meta, components: next });
  };

  const apply = () => {
    const totals = recomputeLineTotalsFromBreakdown(lineQty, meta);
    onApplyTotals(totals);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-slate-800">
          Деталізація вартості (матеріали, фурнітура, послуги)
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={apply}
          className="rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          Застосувати до рядка смети
        </button>
      </div>
      <p className="mt-1 text-[11px] text-slate-600">
        Заповніть підпозиції як у Excel: суми закупівлі та продажу підсумовуються
        й можуть оновити ціну й суму рядка (кнопка вище).
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-500">
              <th className="w-[100px] px-1 py-1.5">Тип</th>
              <th className="min-w-[140px] px-1 py-1.5">Назва</th>
              <th className="w-16 px-1 py-1.5">К-сть</th>
              <th className="w-14 px-1 py-1.5">Од.</th>
              {showCostFields ? (
                <th className="w-24 px-1 py-1.5">Закуп./од.</th>
              ) : null}
              <th className="w-24 px-1 py-1.5">Продаж/од.</th>
              {showCostFields ? (
                <th className="w-24 px-1 py-1.5">Сума закуп.</th>
              ) : null}
              <th className="w-24 px-1 py-1.5">Сума продажу</th>
              <th className="min-w-[80px] px-1 py-1.5">Нотатка</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {meta.components.length === 0 ? (
              <tr>
                <td
                  colSpan={showCostFields ? 10 : 7}
                  className="px-1 py-3 text-center text-slate-500"
                >
                  Підпозицій ще немає — додайте рядок.
                </td>
              </tr>
            ) : (
              meta.components.map((c) => {
                const amtCost =
                  c.unitCost != null && Number.isFinite(c.unitCost)
                    ? c.qty * c.unitCost
                    : null;
                const amtSale =
                  c.unitSale != null && Number.isFinite(c.unitSale)
                    ? c.qty * c.unitSale
                    : 0;
                return (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="px-1 py-1">
                      <select
                        value={c.kind}
                        disabled={disabled}
                        onChange={(e) =>
                          updateComponent(c.id, {
                            kind: e.target.value as BreakdownComponentKind,
                          })
                        }
                        className="w-full max-w-[96px] rounded border border-slate-200 bg-[var(--enver-card)] px-0.5 py-0.5 text-[10px]"
                      >
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {BREAKDOWN_KIND_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={c.name}
                        disabled={disabled}
                        onChange={(e) =>
                          updateComponent(c.id, { name: e.target.value })
                        }
                        placeholder="ЛДСП, петля Blum…"
                        className="w-full min-w-0 rounded border border-slate-200 px-1 py-0.5"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        value={c.qty}
                        disabled={disabled}
                        onChange={(e) =>
                          updateComponent(c.id, {
                            qty: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded border border-slate-200 px-1 py-0.5"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={c.unit}
                        disabled={disabled}
                        onChange={(e) =>
                          updateComponent(c.id, { unit: e.target.value })
                        }
                        className="w-full rounded border border-slate-200 px-1 py-0.5"
                      />
                    </td>
                    {showCostFields ? (
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          value={c.unitCost ?? ""}
                          disabled={disabled}
                          onChange={(e) =>
                            updateComponent(c.id, {
                              unitCost:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                          className="w-full rounded border border-slate-200 px-1 py-0.5"
                        />
                      </td>
                    ) : null}
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        value={c.unitSale ?? ""}
                        disabled={disabled}
                        onChange={(e) =>
                          updateComponent(c.id, {
                            unitSale:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        className="w-full rounded border border-slate-200 px-1 py-0.5"
                      />
                    </td>
                    {showCostFields ? (
                      <td className="px-1 py-1 text-slate-700">
                        {amtCost != null && Number.isFinite(amtCost)
                          ? amtCost.toLocaleString("uk-UA", {
                              maximumFractionDigits: 2,
                            })
                          : "—"}
                      </td>
                    ) : null}
                    <td className="px-1 py-1 text-slate-800">
                      {amtSale.toLocaleString("uk-UA", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={c.note ?? ""}
                        disabled={disabled}
                        onChange={(e) =>
                          updateComponent(c.id, {
                            note: e.target.value || undefined,
                          })
                        }
                        placeholder="—"
                        className="w-full min-w-[4rem] rounded border border-slate-200 px-1 py-0.5 text-[10px]"
                      />
                    </td>
                    <td className="px-0 py-1">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => removeRow(c.id)}
                        className={cn(
                          "rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600",
                          disabled && "pointer-events-none opacity-40",
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={addRow}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-[var(--enver-card)] px-2 py-1 text-[11px] font-medium text-slate-800 hover:bg-[var(--enver-hover)] disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Додати підпозицію
        </button>
      </div>
    </div>
  );
}
