"use client";

/**
 * Таблиця «Кухня без стільниці» — структура як у Excel-КП.
 */
import { Copy, Plus, Trash2 } from "lucide-react";
import { Fragment } from "react";
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
}) {
  const customTableTitle = lines
    .map((l) => l.tableTitle?.trim())
    .find((t) => t);
  const displayTableTitle = customTableTitle ?? sheetTitle;
  const { material: materialSubtotal, measurement: measurementSum } =
    sumKitchenDraftLines(lines);
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

  const markupIntermediate = Math.round(materialSubtotal * 1.1 * 100) / 100;
  const finalClient =
    Math.round(materialSubtotal * KITCHEN_CLIENT_PRICE_MULTIPLIER * 100) /
      100 +
    measurementSum;

  const tableText =
    density === "compact" ? "text-[10px]" : density === "pro" ? "text-[12px]" : "text-[11px]";
  const minTable =
    density === "compact" ? "min-w-[880px]" : density === "pro" ? "min-w-[1040px]" : "min-w-[980px]";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[var(--enver-card)] shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
        {canUpdate && onTableTitleChange ? (
          <input
            type="text"
            value={displayTableTitle}
            onChange={(e) => onTableTitleChange(e.target.value)}
            aria-label="Назва розрахункової таблиці"
            title="Назва таблиці (зберігається разом із сметою)"
            placeholder={sheetTitle}
            className={cn(
              "w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-center font-semibold tracking-tight text-[var(--enver-text)] outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-slate-300 focus:bg-white",
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
        <p className="mt-1 text-center text-[11px] text-slate-500">
          {canUpdate && onCatalogLinePick
            ? "Розрахунок по групах. У колонці «Найменування» — пошук по прайсу або ввід вручну."
            : "Ручний прорахунок по групах матеріалів і робіт"}
        </p>
      </div>
      <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-left", tableText, minTable)}>
        <thead>
          <tr className="sticky top-0 z-10 bg-[#3f66b8] text-white shadow-sm">
            <th className="border border-white/30 px-1.5 py-2 text-center font-semibold">
              № п/п
            </th>
            <th className="border border-white/30 px-2 py-2 font-semibold">
              Найменування матеріалів і робіт
            </th>
            <th
              className="border border-white/30 px-1 py-2 text-center font-semibold"
              colSpan={4}
            >
              Розрахунково
            </th>
          </tr>
          <tr className="sticky top-[36px] z-10 bg-[#3f66b8] text-white">
            <th className="border border-white/30" />
            <th className="border border-white/30" />
            <th className="border border-white/30 px-1 py-1.5 text-center font-medium">
              Кіл-ть
            </th>
            <th className="border border-white/30 px-1 py-1.5 text-center font-medium">
              Коеф.
            </th>
            <th className="border border-white/30 px-1 py-1.5 text-center font-medium">
              Ціна, грн
            </th>
            <th className="border border-white/30 px-1 py-1.5 text-center font-medium">
              Сума, грн
            </th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((group) => (
            <Fragment key={group.key}>
              <tr className="bg-slate-100">
                <td colSpan={6} className="border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-800">
                  <span className="inline-flex w-full items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-base leading-none">{group.icon}</span>
                      <span>{group.label}</span>
                    </span>
                    {canUpdate ? (
                      <button
                        type="button"
                        onClick={() =>
                          onAddMaterialRowToGroup(group.groupId, group.label, group.icon)
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-white px-2 py-0.5 text-[10px] font-medium text-sky-700 hover:bg-sky-50 hover:text-sky-900"
                        title="Додати рядок у групу"
                      >
                        <Plus className="h-3 w-3" />
                        Додати рядок
                      </button>
                    ) : null}
                  </span>
                </td>
              </tr>
              <tr
                className={cn(
                  "bg-slate-50 uppercase text-slate-600",
                  density === "pro" ? "text-[11px]" : "text-[10px]",
                )}
              >
                <td className="border border-slate-200 px-1 py-1 text-center font-semibold">№</td>
                <td className="border border-slate-200 px-2 py-1 align-bottom font-semibold">
                  {canUpdate && onCatalogLinePick ? (
                    <span className="block">
                      <span className="block uppercase tracking-wide">
                        Найменування
                      </span>
                      <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-slate-500">
                        Пошук у прайсі: введіть 2+ літери
                      </span>
                    </span>
                  ) : (
                    "Найменування"
                  )}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-center font-semibold">Кіл-ть</td>
                <td className="border border-slate-200 px-1 py-1 text-center font-semibold">Коеф.</td>
                <td className="border border-slate-200 px-1 py-1 text-center font-semibold">Ціна</td>
                <td className="border border-slate-200 px-1 py-1 text-center font-semibold">Сума</td>
              </tr>
              {group.rows.map((li) => {
            const coeff = li.coefficient ?? 1;
            const tan = li.rowStyle === "tan";
            const orange = li.rowStyle === "orange";
            return (
              <tr
                key={li.id}
                className={cn(
                  "border-b border-slate-200",
                  tan && "bg-[#FCE4D6]",
                  orange && "bg-orange-200",
                  !tan && !orange && "bg-[var(--enver-card)]",
                )}
              >
                <td className="border border-slate-200 px-1 py-1 text-center text-slate-800">
                  {lines.findIndex((x) => x.id === li.id) + 1}
                </td>
                <td className="border border-slate-200 px-2 py-1 align-top">
                  {canUpdate && onCatalogLinePick ? (
                    <MaterialCatalogCombobox
                      value={li.productName}
                      onChange={(next) =>
                        onUpdateLine(li.id, { productName: next })
                      }
                      onCatalogPick={(hit) => onCatalogLinePick(li.id, hit)}
                      disabled={!canUpdate}
                      className={tableText}
                    />
                  ) : (
                    <input
                      value={li.productName}
                      onChange={(e) =>
                        onUpdateLine(li.id, { productName: e.target.value })
                      }
                      disabled={!canUpdate}
                      className={cn(
                        "w-full min-w-[16rem] rounded-md border border-transparent bg-transparent px-1 py-0.5 hover:border-slate-300 focus:border-slate-400 focus:bg-white focus:outline-none",
                        tableText,
                      )}
                    />
                  )}
                </td>
                <td className="border border-slate-200 px-0.5 py-0.5 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={li.qty}
                    onChange={(e) =>
                      onUpdateLine(li.id, {
                        qty: Number(e.target.value) || 0,
                      })
                    }
                    disabled={!canUpdate}
                    className={cn(
                      "w-full min-w-[3.5rem] rounded-md border border-slate-200 px-1 py-0.5 text-right focus:border-slate-400 focus:outline-none",
                      tableText,
                    )}
                  />
                </td>
                <td className="border border-slate-200 px-0.5 py-0.5 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={coeff}
                    onChange={(e) =>
                      onUpdateLine(li.id, {
                        coefficient: Number(e.target.value) || 0,
                      })
                    }
                    disabled={!canUpdate}
                    className={cn(
                      "w-full min-w-[3rem] rounded-md border border-slate-200 px-1 py-0.5 text-right focus:border-slate-400 focus:outline-none",
                      tableText,
                    )}
                  />
                </td>
                <td className="border border-slate-200 px-0.5 py-0.5 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={li.salePrice}
                    onChange={(e) =>
                      onUpdateLine(li.id, {
                        salePrice: Number(e.target.value) || 0,
                      })
                    }
                    disabled={!canUpdate}
                    className={cn(
                      "w-full min-w-[4rem] rounded-md border border-slate-200 px-1 py-0.5 text-right focus:border-slate-400 focus:outline-none",
                      tableText,
                    )}
                  />
                </td>
                <td className="border border-slate-200 px-1.5 py-1 text-right font-medium tabular-nums text-[var(--enver-text)]">
                  <span className="inline-flex w-full items-center justify-end gap-1">
                    <span>{formatNum(li.amountSale, 2)}</span>
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
                </td>
              </tr>
            );
              })}
              <tr className="bg-slate-100/90">
                <td
                  colSpan={5}
                  className="border border-slate-200 px-2 py-1 text-right text-[10px] font-semibold text-slate-600"
                >
                  Підсумок по секції
                </td>
                <td className="border border-slate-200 px-1.5 py-1 text-right text-[11px] font-semibold tabular-nums text-[var(--enver-text)]">
                  {formatNum(
                    group.rows.reduce((s, r) => s + r.amountSale, 0),
                    2,
                  )}
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-yellow-200">
            <td
              colSpan={5}
              className="border border-slate-300 px-2 py-2 text-right font-semibold text-[var(--enver-text)]"
            >
              Підсумкова СОБІВАРТІСТЬ по замовленню (без урахування доставки)
            </td>
            <td className="border border-slate-300 px-2 py-2 text-right text-sm font-bold tabular-nums">
              {formatNum(materialSubtotal, 2)}
            </td>
          </tr>
          <tr className="bg-slate-50">
            <td className="border border-slate-300 px-2 py-1.5 text-center font-semibold text-red-600">
              {KITCHEN_CLIENT_PRICE_MULTIPLIER.toLocaleString("uk-UA", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </td>
            <td className="border border-slate-300 px-2 py-1.5" />
            <td
              colSpan={2}
              className="border border-slate-300 bg-yellow-200 px-2 py-1.5 text-center font-semibold"
            >
              {KITCHEN_MARKUP_PERCENT_LABEL}%
            </td>
            <td className="border border-slate-300" />
            <td className="border border-slate-300 bg-orange-200 px-2 py-1.5 text-right font-semibold tabular-nums">
              {formatNum(markupIntermediate, 2)}
            </td>
          </tr>
          <tr className="bg-yellow-300">
            <td
              colSpan={5}
              className="border border-slate-300 px-2 py-2 text-right font-semibold text-[var(--enver-text)]"
            >
              Підсумкова ВАРТІСТЬ по замовленню
            </td>
            <td className="border border-slate-300 px-2 py-2 text-right text-sm font-bold tabular-nums">
              {formatNum(finalClient, 2)}
            </td>
          </tr>
        </tfoot>
      </table>
      </div>
      {canUpdate ? (
        <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-2.5">
          <button
            type="button"
            onClick={onAddMaterialRow}
            className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-white px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 hover:text-sky-900"
          >
            <Plus className="h-3.5 w-3.5" />
            Додати рядок (матеріали)
          </button>
        </div>
      ) : null}
    </div>
  );
}
