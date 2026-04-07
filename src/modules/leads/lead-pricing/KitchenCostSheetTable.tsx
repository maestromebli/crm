"use client";

/**
 * Таблиця розрахунку меблів (структура Excel-КП по зонах).
 */
import { Copy, Plus, Trash2 } from "lucide-react";
import { Fragment, useMemo } from "react";
import {
  KITCHEN_CLIENT_PRICE_MULTIPLIER,
  KITCHEN_MARKUP_PERCENT_LABEL,
  sumKitchenDraftLines,
} from "../../../lib/estimates/kitchen-cost-sheet-template";
import { cn } from "../../../lib/utils";
import type { MaterialSearchHit } from "../../../lib/materials/material-provider";
import type { EstimateLineDraft } from "./estimate-line-draft";
import { MaterialCatalogCombobox } from "./MaterialCatalogCombobox";

function formatNum(n: number, maxFrac = 2): string {
  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: n % 1 === 0 ? 0 : Math.min(maxFrac, 2),
    maximumFractionDigits: maxFrac,
  }).format(n);
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function parseCoeff(raw: string, fallback: number): number {
  const v = parseFloat(String(raw).replace(",", "."));
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, v);
}

export function KitchenCostSheetTable({
  sheetTitle,
  lines,
  density = "standard",
  canUpdate,
  showCostFields: _showCostFields,
  onUpdateLine,
  onRemoveLine,
  onDuplicateLine,
  onAddMaterialRow,
  onAddMaterialRowToGroup,
  onTableTitleChange,
  onCatalogLinePick,
  onKitchenPricingChange,
  /** Лише клієнтський коефіцієнт; % націнки лишається поточним (якщо не передано onKitchenPricingChange). */
  onClientMultiplierChange,
}: {
  sheetTitle: string;
  lines: EstimateLineDraft[];
  /** Щільність з `LeadPricingWorkspaceClient` (лише UI). */
  density?: "compact" | "standard" | "pro";
  canUpdate: boolean;
  showCostFields: boolean;
  onUpdateLine: (id: string, patch: Partial<EstimateLineDraft>) => void;
  onRemoveLine: (id: string) => void;
  onDuplicateLine: (li: EstimateLineDraft) => void;
  onAddMaterialRow: () => void;
  onAddMaterialRowToGroup: (
    groupId: string,
    groupLabel: string,
    groupIcon: string,
  ) => void;
  /** Редагування заголовка таблиці (назва зберігається в рядках смети) */
  onTableTitleChange?: (title: string) => void;
  /** Вибір позиції з бази прайсів (підставляє назву, ціну, од. виміру, категорію) */
  onCatalogLinePick?: (lineId: string, hit: MaterialSearchHit) => void;
  /** Редагування клієнтського коефіцієнта та % націнки на матеріали */
  onKitchenPricingChange?: (
    clientMultiplier: number,
    markupPercent: number,
  ) => void;
  onClientMultiplierChange?: (clientMultiplier: number) => void;
}) {
  const customTableTitle = lines
    .map((l) => l.tableTitle?.trim())
    .find((t) => t);
  const displayTableTitle = customTableTitle ?? sheetTitle;
  const { material: materialSubtotal, measurement: measurementSum } =
    sumKitchenDraftLines(lines);

  const clientMultiplier = useMemo(() => {
    const v = lines
      .map((l) => l.kitchenClientPriceMultiplier)
      .find((x) => x != null && Number.isFinite(x) && x > 0);
    return v ?? KITCHEN_CLIENT_PRICE_MULTIPLIER;
  }, [lines]);

  const markupPercent = useMemo(() => {
    const v = lines
      .map((l) => l.kitchenMaterialMarkupPercent)
      .find((x) => x != null && Number.isFinite(x) && x > 0);
    return v ?? KITCHEN_MARKUP_PERCENT_LABEL;
  }, [lines]);

  const markupIntermediate =
    Math.round(materialSubtotal * (markupPercent / 100) * 100) / 100;
  const finalClient =
    Math.round(materialSubtotal * clientMultiplier * 100) / 100 +
    measurementSum;

  const canEditClientMultiplier =
    canUpdate &&
    (onKitchenPricingChange != null || onClientMultiplierChange != null);
  const canEditMarkupPercent = canUpdate && onKitchenPricingChange != null;

  const setClientMultiplier = (raw: number) => {
    const v = Math.min(10, Math.max(0.5, raw));
    if (onKitchenPricingChange) {
      onKitchenPricingChange(v, markupPercent);
    } else if (onClientMultiplierChange) {
      onClientMultiplierChange(v);
    }
  };

  const setMarkupPercent = (raw: number) => {
    if (!onKitchenPricingChange) return;
    const v = Math.min(500, Math.max(1, raw));
    onKitchenPricingChange(clientMultiplier, v);
  };

  const grouped = lines.reduce<
    Array<{
      key: string;
      groupId: string;
      label: string;
      icon: string;
      rows: EstimateLineDraft[];
    }>
  >((acc, li) => {
    const groupId = li.groupId ?? "custom";
    const label = li.groupLabel ?? "Інші матеріали";
    const icon = li.groupIcon ?? "📦";
    const key = `${groupId}|${icon}|${label}`;
    const existing = acc.find((x) => x.key === key);
    if (existing) {
      existing.rows.push(li);
    } else {
      acc.push({ key, groupId, label, icon, rows: [li] });
    }
    return acc;
  }, []);

  const tableText =
    density === "compact"
      ? "text-[10px]"
      : density === "pro"
        ? "text-[12px]"
        : "text-[11px]";
  const minTable =
    density === "compact"
      ? "min-w-[880px]"
      : density === "pro"
        ? "min-w-[1040px]"
        : "min-w-[980px]";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-[var(--enver-card)] shadow-md ring-1 ring-slate-900/5">
      <div className="border-b border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-sky-50/40 px-4 py-3">
        {canUpdate && onTableTitleChange ? (
          <input
            type="text"
            value={displayTableTitle}
            onChange={(e) => onTableTitleChange(e.target.value)}
            aria-label="Назва розрахункової таблиці"
            title="Назва таблиці (зберігається разом із сметою)"
            placeholder={sheetTitle}
            className={cn(
              "w-full rounded-lg border border-transparent bg-white/60 px-2 py-1.5 text-center font-semibold tracking-tight text-[var(--enver-text)] shadow-sm outline-none backdrop-blur-sm placeholder:font-normal placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-200/60",
              density === "pro" ? "text-lg" : "text-base",
            )}
          />
        ) : (
          <div
            className={cn(
              "text-center font-semibold tracking-tight text-[var(--enver-text)]",
              density === "pro" ? "text-lg" : "text-base",
            )}
          >
            {displayTableTitle}
          </div>
        )}
        <p className="mt-1.5 text-center text-[11px] leading-snug text-slate-600">
          {canUpdate && onCatalogLinePick
            ? "За зонами (як у Excel-КП). У «Найменуванні» — пошук по прайсу або введення вручну. Коеф. — запас / норма на одиницю."
            : "Перегляд розрахунку по зонах матеріалів і робіт"}
        </p>
        {canUpdate ? (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onAddMaterialRow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-1.5 text-[11px] font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              Додати свою позицію
            </button>
            <span className="hidden text-[10px] text-slate-500 sm:inline">
              (у кінець таблиці, група «Інше»)
            </span>
          </div>
        ) : null}
      </div>

      {canEditClientMultiplier && lines.length > 0 ? (
        <div className="border-b border-amber-200/80 bg-amber-50/60 px-3 py-2 text-center text-[11px] leading-snug text-amber-950">
          У жовтому рядку підсумку таблиці нижче можна змінити{" "}
          <strong>клієнтський коефіцієнт</strong>
          {canEditMarkupPercent ? (
            <>
              {" "}
              та <strong>% націнки</strong> на матеріали
            </>
          ) : null}
          . Збережіть смету після змін.
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table
          className={cn("w-full border-collapse text-left", tableText, minTable)}
        >
          <thead>
            <tr className="sticky top-0 z-10 bg-gradient-to-b from-[#4a6fc4] to-[#3f66b8] text-white shadow-md">
              <th className="border border-white/25 px-1.5 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide">
                № п/п
              </th>
              <th className="border border-white/25 px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wide">
                Найменування матеріалів і робіт
              </th>
              <th
                className="border border-white/25 px-1 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide"
                colSpan={4}
              >
                Розрахунок
              </th>
            </tr>
            <tr className="sticky top-[38px] z-10 bg-[#3a5daa] text-white/95">
              <th className="border border-white/20" />
              <th className="border border-white/20" />
              <th className="border border-white/20 px-1 py-1.5 text-center text-[10px] font-medium">
                Кіл-ть
              </th>
              <th
                className="border border-white/20 px-1 py-1.5 text-center text-[10px] font-medium"
                title="Множник (норма, запас, площа тощо)"
              >
                Коеф.
              </th>
              <th className="border border-white/20 px-1 py-1.5 text-center text-[10px] font-medium">
                Ціна, грн
              </th>
              <th className="border border-white/20 px-1 py-1.5 text-center text-[10px] font-medium">
                Сума, грн
              </th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((group) => (
              <Fragment key={group.key}>
                <tr className="bg-slate-200/90">
                  <td
                    colSpan={6}
                    className="border border-slate-300/80 px-2 py-2 text-xs font-bold text-slate-800"
                  >
                    <span className="inline-flex w-full items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-base leading-none" aria-hidden>
                          {group.icon}
                        </span>
                        <span>{group.label}</span>
                      </span>
                      {canUpdate ? (
                        <button
                          type="button"
                          onClick={() =>
                            onAddMaterialRowToGroup(
                              group.groupId,
                              group.label,
                              group.icon,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-sky-300/80 bg-white px-2 py-1 text-[10px] font-semibold text-sky-800 shadow-sm hover:bg-sky-50"
                          title="Додати рядок у цю групу"
                        >
                          <Plus className="h-3 w-3" />
                          У групу
                        </button>
                      ) : null}
                    </span>
                  </td>
                </tr>
                <tr
                  className={cn(
                    "bg-slate-100/95 text-slate-700",
                    density === "pro" ? "text-[11px]" : "text-[10px]",
                  )}
                >
                  <td className="border border-slate-200 px-1 py-1.5 text-center font-bold">
                    №
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 align-bottom font-bold">
                    {canUpdate && onCatalogLinePick ? (
                      <span className="block">
                        <span className="block uppercase tracking-wide">
                          Найменування
                        </span>
                        <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-slate-500">
                          Пошук у прайсі: від 2 літер
                        </span>
                      </span>
                    ) : (
                      "Найменування"
                    )}
                  </td>
                  <td className="border border-slate-200 px-1 py-1.5 text-center font-bold">
                    Кіл-ть
                  </td>
                  <td className="border border-slate-200 px-1 py-1.5 text-center font-bold">
                    Коеф.
                  </td>
                  <td className="border border-slate-200 px-1 py-1.5 text-center font-bold">
                    Ціна
                  </td>
                  <td className="border border-slate-200 px-1 py-1.5 text-center font-bold">
                    Сума
                  </td>
                </tr>
                {group.rows.map((li) => {
                  const coeff = li.coefficient ?? 1;
                  const tan = li.rowStyle === "tan";
                  const orange = li.rowStyle === "orange";
                  return (
                    <tr
                      key={li.id}
                      className={cn(
                        "transition-colors",
                        tan && "bg-[#fce4d6]",
                        orange && "bg-orange-100",
                        !tan && !orange && "bg-[var(--enver-card)] hover:bg-slate-50/80",
                      )}
                    >
                      <td className="border border-slate-200 px-1 py-1 text-center tabular-nums text-slate-800">
                        {lines.findIndex((x) => x.id === li.id) + 1}
                      </td>
                      <td className="border border-slate-200 px-2 py-1 align-top">
                        {canUpdate && onCatalogLinePick ? (
                          <MaterialCatalogCombobox
                            value={li.productName}
                            onChange={(next) =>
                              onUpdateLine(li.id, { productName: next })
                            }
                            onCatalogPick={(hit) =>
                              onCatalogLinePick(li.id, hit)
                            }
                            disabled={!canUpdate}
                            className={tableText}
                          />
                        ) : (
                          <input
                            value={li.productName}
                            onChange={(e) =>
                              onUpdateLine(li.id, {
                                productName: e.target.value,
                              })
                            }
                            disabled={!canUpdate}
                            className={cn(
                              "w-full min-w-[16rem] rounded-md border border-transparent bg-transparent px-1 py-0.5 hover:border-slate-300 focus:border-slate-400 focus:bg-white focus:outline-none",
                              tableText,
                            )}
                          />
                        )}
                      </td>
                      <td className="border border-slate-200 px-0.5 py-0.5 text-right align-middle">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={li.qty}
                          onChange={(e) =>
                            onUpdateLine(li.id, {
                              qty: Math.max(
                                0,
                                parseFloat(
                                  e.target.value.replace(",", "."),
                                ) || 0,
                              ),
                            })
                          }
                          disabled={!canUpdate}
                          className={cn(
                            "w-full min-w-[3.5rem] rounded-md border border-slate-200 bg-white/90 px-1 py-0.5 text-right shadow-inner focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200",
                            tableText,
                          )}
                        />
                      </td>
                      <td className="border border-slate-200 px-0.5 py-0.5 text-right align-middle">
                        <input
                          type="number"
                          step="0.05"
                          min={0}
                          title="Коефіцієнт (запас, норма)"
                          value={coeff}
                          onChange={(e) =>
                            onUpdateLine(li.id, {
                              coefficient: parseCoeff(
                                e.target.value,
                                li.coefficient ?? 1,
                              ),
                            })
                          }
                          disabled={!canUpdate}
                          className={cn(
                            "w-full min-w-[3.25rem] rounded-md border border-slate-200 bg-amber-50/50 px-1 py-0.5 text-right font-medium tabular-nums focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-200",
                            tableText,
                          )}
                        />
                      </td>
                      <td className="border border-slate-200 px-0.5 py-0.5 text-right align-middle">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={li.salePrice}
                          onChange={(e) =>
                            onUpdateLine(li.id, {
                              salePrice: Math.max(
                                0,
                                parseFloat(
                                  e.target.value.replace(",", "."),
                                ) || 0,
                              ),
                            })
                          }
                          disabled={!canUpdate}
                          className={cn(
                            "w-full min-w-[4rem] rounded-md border border-slate-200 bg-white/90 px-1 py-0.5 text-right focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200",
                            tableText,
                          )}
                        />
                      </td>
                      <td className="border border-slate-200 px-1.5 py-1 text-right align-middle font-medium tabular-nums text-[var(--enver-text)]">
                        <span className="inline-flex w-full flex-col items-end gap-1 sm:flex-row sm:items-center sm:justify-end">
                          {canUpdate ? (
                            <select
                              value={li.kitchenRole ?? "material"}
                              onChange={(e) =>
                                onUpdateLine(li.id, {
                                  kitchenRole: e.target.value as
                                    | "material"
                                    | "measurement",
                                })
                              }
                              title="Матеріали входять у націнку; «Замір» — окремо (без множника)"
                              className="max-w-[7.5rem] rounded border border-slate-200 bg-white py-0.5 pl-1 text-[9px] font-medium text-slate-700 focus:border-sky-400 focus:outline-none"
                            >
                              <option value="material">Матеріали</option>
                              <option value="measurement">Замір / без ×</option>
                            </select>
                          ) : null}
                          <span className="inline-flex items-center gap-1">
                            <span>{formatMoney(li.amountSale)}</span>
                            {canUpdate ? (
                              <span className="inline-flex shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onDuplicateLine(li)}
                                  className="rounded-md p-0.5 text-slate-400 hover:bg-sky-50 hover:text-sky-700"
                                  title="Дублювати"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRemoveLine(li.id)}
                                  className="rounded-md p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  title="Видалити"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-100">
                  <td
                    colSpan={5}
                    className="border border-slate-200 px-2 py-1.5 text-right text-[10px] font-semibold text-slate-600"
                  >
                    Підсумок по секції
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1.5 text-right text-[11px] font-bold tabular-nums text-[var(--enver-text)]">
                    {formatMoney(
                      group.rows.reduce((s, r) => s + r.amountSale, 0),
                    )}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-amber-100/90">
              <td
                colSpan={5}
                className="border border-slate-300 px-2 py-2.5 text-right text-xs font-semibold text-[var(--enver-text)]"
              >
                Підсумкова собівартість (матеріали, без доставки смети)
              </td>
              <td className="border border-slate-300 px-2 py-2.5 text-right text-sm font-bold tabular-nums text-slate-900">
                {formatMoney(materialSubtotal)}
              </td>
            </tr>
            <tr className="bg-slate-50">
              <td className="border border-slate-300 px-1 py-1.5 text-center align-middle">
                {canEditClientMultiplier ? (
                  <input
                    type="number"
                    step={0.05}
                    min={0.5}
                    max={10}
                    value={clientMultiplier}
                    aria-label="Клієнтський коефіцієнт (множник до суми матеріалів)"
                    title="Типово 2,1 — сума матеріалів × коеф. + рядки «Замір»"
                    onChange={(e) => {
                      const v = parseFloat(
                        e.target.value.replace(",", "."),
                      );
                      if (!Number.isFinite(v)) return;
                      setClientMultiplier(v);
                    }}
                    className="mx-auto w-full max-w-[5.5rem] rounded-md border-2 border-red-300 bg-white px-1 py-1 text-center text-sm font-bold tabular-nums text-red-800 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-200"
                  />
                ) : (
                  <span className="text-xs font-bold text-red-700 tabular-nums">
                    {clientMultiplier.toLocaleString("uk-UA", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                )}
              </td>
              <td className="border border-slate-300 px-2 py-2 text-[10px] leading-tight text-slate-600">
                клієнтський коеф. до матеріалів
              </td>
              <td
                colSpan={2}
                className="border border-slate-300 bg-amber-100/80 px-1 py-1.5 text-center align-middle"
              >
                {canEditMarkupPercent ? (
                  <span className="inline-flex flex-wrap items-center justify-center gap-1 text-[10px] text-slate-700">
                    <input
                      type="number"
                      step={1}
                      min={1}
                      max={500}
                      value={markupPercent}
                      aria-label="Націнка на матеріали у відсотках"
                      title="% від суми матеріалів для проміжного рядка"
                      onChange={(e) => {
                        const v = parseFloat(
                          e.target.value.replace(",", "."),
                        );
                        if (!Number.isFinite(v)) return;
                        setMarkupPercent(v);
                      }}
                      className="w-16 rounded-md border border-amber-400 bg-white px-1 py-1 text-center text-sm font-bold tabular-nums text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-200"
                    />
                    <span className="text-xs font-semibold">% націнка</span>
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-900">
                    {formatNum(markupPercent, 0)}% націнка
                  </span>
                )}
              </td>
              <td className="border border-slate-300" />
              <td className="border border-slate-300 bg-orange-100/90 px-2 py-2 text-right text-xs font-bold tabular-nums text-slate-900">
                {formatMoney(markupIntermediate)}
              </td>
            </tr>
            <tr className="bg-amber-200/95">
              <td
                colSpan={5}
                className="border border-slate-300 px-2 py-2.5 text-right text-xs font-bold text-[var(--enver-text)]"
              >
                Підсумкова вартість по замовленню (клієнт)
              </td>
              <td className="border border-slate-300 px-2 py-2.5 text-right text-sm font-bold tabular-nums text-slate-900">
                {formatMoney(finalClient)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {canUpdate ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-2.5">
          <button
            type="button"
            onClick={onAddMaterialRow}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 shadow-sm hover:bg-sky-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Додати рядок (кінець таблиці)
          </button>
          <p className="text-[10px] text-slate-500">
            Рядки «Замір / без ×» не множаться на клієнтський коефіцієнт у підсумку.
          </p>
        </div>
      ) : null}
    </div>
  );
}
