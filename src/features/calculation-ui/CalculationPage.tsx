"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { EstimateLineType } from "@prisma/client";
import { useCalculationAI } from "../calculation-ai/useCalculationAI";
import type { CalculationAINextAction, CalculationAISuggestion } from "../calculation-ai/calculationAIEngine";
import type { DealWorkspacePayload } from "../deal-workspace/types";
import { useDealEstimateWorkspace } from "../../modules/estimate-workspace/useDealEstimateWorkspace";
import { CalculationSidebar } from "./CalculationSidebar";
import { CalculationTable } from "./CalculationTable";
import { CalculationToolbar } from "./CalculationToolbar";
import { useCalculationStore, type CalculationRow, type CalculationRowType } from "./calculationStore";

export type CalculationPageProps = {
  dealId: string;
  dealTitle: string;
  estimateVisibility?: "director" | "head" | "sales";
  workspacePayload?: DealWorkspacePayload;
};

function rowTypeFromLineType(type: EstimateLineType): CalculationRowType {
  if (type === "MATERIAL" || type === "PRODUCT") return "material";
  if (type === "FITTING") return "fitting";
  if (type === "SERVICE" || type === "DELIVERY" || type === "INSTALLATION" || type === "WORK") {
    return "service";
  }
  return "measurement";
}

function lineTypeFromRowType(type: CalculationRowType): EstimateLineType {
  if (type === "material") return "MATERIAL";
  if (type === "fitting") return "FITTING";
  if (type === "service") return "SERVICE";
  return "WORK";
}

function pickMainSectionId(sections: Array<{ id: string }>): string | null {
  return sections[0]?.id ?? null;
}

function makeLocalLineId() {
  return `calc_line_${crypto.randomUUID()}`;
}

function toCalculationRows(lines: Array<{
  id: string;
  sectionId: string | null;
  productName: string;
  type: EstimateLineType;
  qty: number;
  unit: string;
  salePrice: number;
  metadataJson: Record<string, unknown>;
}>): CalculationRow[] {
  return lines.map((line) => {
    const meta = line.metadataJson ?? {};
    const hints =
      meta.estimateViewHints && typeof meta.estimateViewHints === "object"
        ? (meta.estimateViewHints as Record<string, unknown>)
        : {};
    const uiBaseQtyRaw = hints.uiBaseQty;
    const uiCoeffRaw = hints.uiCoeff;
    const qty =
      typeof uiBaseQtyRaw === "number" && Number.isFinite(uiBaseQtyRaw)
        ? uiBaseQtyRaw
        : line.qty;
    const coeff =
      typeof uiCoeffRaw === "number" && Number.isFinite(uiCoeffRaw)
        ? uiCoeffRaw
        : 1;
    const amount = qty * coeff * line.salePrice;
    return {
      id: line.id,
      sourceLineId: line.id,
      sectionId: line.sectionId,
      name: line.productName,
      type: rowTypeFromLineType(line.type),
      qty,
      coeff,
      price: line.salePrice,
      amount,
      unit: line.unit,
      selected: false,
    };
  });
}

export function CalculationPage({
  dealId,
  dealTitle,
  workspacePayload,
}: CalculationPageProps) {
  const router = useRouter();
  const ws = useDealEstimateWorkspace(dealId);
  const rows = useCalculationStore((s) => s.rows);
  const totals = useCalculationStore((s) => s.totals);
  const version = useCalculationStore((s) => s.version);
  const setRows = useCalculationStore((s) => s.setRows);
  const setVersion = useCalculationStore((s) => s.setVersion);
  const setMarkupPercent = useCalculationStore((s) => s.setMarkupPercent);
  const setAISuggestions = useCalculationStore((s) => s.setAISuggestions);
  const updateRow = useCalculationStore((s) => s.updateRow);
  const deleteRow = useCalculationStore((s) => s.deleteRow);
  const duplicateRow = useCalculationStore((s) => s.duplicateRow);
  const reorderRows = useCalculationStore((s) => s.reorderRows);
  const toggleSelect = useCalculationStore((s) => s.toggleSelect);
  const applyAISuggestion = useCalculationStore((s) => s.applyAISuggestion);
  const recalcTotals = useCalculationStore((s) => s.recalcTotals);

  useEffect(() => {
    if (!ws.snap) return;
    setRows(toCalculationRows(ws.snap.lines));
    const activeVersion = ws.list.find((x) => x.id === ws.activeId)?.version ?? 1;
    setVersion(`v${activeVersion}`);
  }, [setRows, setVersion, ws.activeId, ws.list, ws.snap]);

  const ai = useCalculationAI(rows, totals, workspacePayload);

  useEffect(() => {
    setAISuggestions(ai.suggestions);
  }, [ai.suggestions, setAISuggestions]);

  const warnings = useMemo(
    () =>
      ai.warnings.map((warning) => {
        const row = rows.find((x) => x.id === warning.rowId);
        return {
          rowId: row?.id,
          message: warning.message,
        };
      }),
    [ai.warnings, rows],
  );

  const updateRowEverywhere = (rowId: string, patch: Partial<CalculationRow>) => {
    updateRow(rowId, patch);
    const current = rows.find((x) => x.id === rowId);
    if (!current?.sourceLineId) return;
    const merged = { ...current, ...patch };
    ws.updateLine(current.sourceLineId, {
      productName: merged.name,
      qty: merged.qty * merged.coeff,
      salePrice: merged.price,
      unit: merged.unit,
      type: lineTypeFromRowType(merged.type),
    });
    ws.updateLineMeta(current.sourceLineId, {
      description: "AI Calculation UI",
      estimateViewHints: {
        uiBaseQty: merged.qty,
        uiCoeff: merged.coeff,
      },
    });
  };

  const handleAddRow = () => {
    const sectionId = pickMainSectionId(ws.snap?.sections ?? []);
    ws.addLine(sectionId, "MATERIAL", "Нова позиція");
  };

  const handleDeleteRow = (rowId: string) => {
    const row = rows.find((x) => x.id === rowId);
    deleteRow(rowId);
    if (row?.sourceLineId) ws.deleteLine(row.sourceLineId);
  };

  const handleDuplicateRow = (rowId: string) => {
    const row = rows.find((x) => x.id === rowId);
    duplicateRow(rowId);
    if (row?.sourceLineId) ws.duplicateLine(row.sourceLineId);
  };

  const handleApplySuggestion = (suggestion: CalculationAISuggestion) => {
    applyAISuggestion(suggestion);
    if (suggestion.rowId && suggestion.patch) {
      updateRowEverywhere(suggestion.rowId, suggestion.patch);
    }
  };

  const runAction = (action: CalculationAINextAction) => {
    if (action.type === "raise-margin") {
      const selected = rows.filter((x) => x.selected);
      const targetRows = selected.length > 0 ? selected : rows;
      for (const row of targetRows) {
        updateRowEverywhere(row.id, { price: Number((row.price * 1.1).toFixed(2)) });
      }
      return;
    }
    if (action.type === "add-installation") {
      const sectionId = pickMainSectionId(ws.snap?.sections ?? []);
      ws.addLine(sectionId, "INSTALLATION", "Монтаж");
      return;
    }
    if (action.type === "add-standards") {
      const sectionId = pickMainSectionId(ws.snap?.sections ?? []);
      ws.addLine(sectionId, "MATERIAL", "Кромка ПВХ");
      ws.addLine(sectionId, "FITTING", "Направляючі");
      return;
    }
    if (action.type === "create-quote") {
      router.push(`/deals/${dealId}/workspace?tab=proposal`);
      return;
    }
    recalcTotals();
  };

  if (ws.loading && !ws.snap) {
    return <div className="p-4 text-sm text-slate-500">Завантаження розрахунку…</div>;
  }

  return (
    <div className="min-h-[calc(100vh-170px)] bg-slate-50">
      <CalculationToolbar
        version={version}
        onAddRow={handleAddRow}
        onImportExcel={() => {}}
        onSave={() => void ws.saveNow()}
        onConvertQuote={() => router.push(`/deals/${dealId}/workspace?tab=proposal`)}
      />
      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
        <div className="space-y-3">
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-blue-900">
            Угода: <span className="font-semibold">{dealTitle}</span>. Enter додає рядок, вставка з Excel підтримує формат
            `Назва\tКіль\tКоеф\tЦіна`.
          </div>
          <CalculationTable
            rows={rows}
            warnings={warnings}
            suggestions={ai.suggestions}
            onAddRow={handleAddRow}
            onUpdateRow={updateRowEverywhere}
            onDeleteRow={handleDeleteRow}
            onDuplicateRow={handleDuplicateRow}
            onToggleSelect={toggleSelect}
            onReorderRows={reorderRows}
            onApplySuggestion={handleApplySuggestion}
            onBulkPaste={(items) => {
              const sectionId = pickMainSectionId(ws.snap?.sections ?? []);
              ws.patchWorkspace((snapshot) => {
                const baseSort = snapshot.lines.length;
                const appended = items.map((item, index) => {
                  const qty = Number(item.qty) || 0;
                  const coeff = Number(item.coeff) || 1;
                  const price = Number(item.price) || 0;
                  const lineId = makeLocalLineId();
                  return {
                    id: lineId,
                    stableLineId: lineId,
                    sectionId,
                    type: lineTypeFromRowType(item.type ?? "material"),
                    category: null,
                    code: null,
                    productName: item.name?.trim() || "Позиція з Excel",
                    qty: qty * coeff,
                    unit: "шт",
                    salePrice: price,
                    costPrice: null,
                    amountSale: qty * coeff * price,
                    amountCost: null,
                    supplierRef: null,
                    notes: null,
                    metadataJson: {
                      estimateViewHints: {
                        uiBaseQty: qty,
                        uiCoeff: coeff,
                      },
                    },
                    sortOrder: baseSort + index,
                  };
                });
                return {
                  ...snapshot,
                  lines: [...snapshot.lines, ...appended],
                };
              }, true);
            }}
          />
        </div>
        <CalculationSidebar
          totals={totals}
          suggestions={ai.suggestions}
          warnings={ai.warnings}
          actions={ai.actions}
          onChangeMarkup={setMarkupPercent}
          onApplySuggestion={handleApplySuggestion}
          onRunAction={runAction}
        />
      </div>
    </div>
  );
}
