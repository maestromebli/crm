"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { canSyncDealValueFromLatestEstimate } from "../../features/deal-workspace/deal-workspace-warnings";
import { SyncDealValueFromEstimateButton } from "../../components/deal-workspace/SyncDealValueFromEstimateButton";
import type { EstimateLineType } from "@prisma/client";
import { cn } from "../../lib/utils";
import {
  LINE_TYPE_LABELS,
  UKR_PRODUCT_QUICK_TEMPLATES,
} from "../../lib/estimate-workspace/types";
import { parseWorkspaceMeta } from "../../lib/estimate-workspace/line-meta";
import {
  EstimateCompareModal,
  FormulaEditorModal,
  GenerateQuoteModal,
} from "./EstimateWorkspaceModals";
import { useDealEstimateWorkspace, type LineModel } from "./useDealEstimateWorkspace";
import type { EstimateLineWorkspaceMeta } from "../../lib/estimate-workspace/types";
import type { EstimateVisibility } from "../../components/deal-workspace/tabs/EstimateWorkspaceTab";
import { MaterialSupplierPicker } from "../../features/estimate/components/MaterialSupplierPicker";
import type { CatalogItemRecord } from "../../features/estimate/services/material-provider-types";
import type { CompareEstimateVersionsResult } from "../../lib/estimates/compare-estimate-versions";

const bg = "bg-[#FAFAFA]";
const card = "rounded-[12px] border border-[#E5E7EB] bg-white shadow-sm";
const text = "text-[#111111]";
const muted = "text-[#6B7280]";
const btnPrimary =
  "inline-flex items-center justify-center rounded-[12px] bg-[#2563EB] px-3 py-2 text-[14px] font-medium text-white transition hover:bg-blue-700 disabled:opacity-50";
const btnSecondary =
  "inline-flex items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2 text-[14px] font-medium text-[#111111] transition hover:bg-[#FAFAFA] disabled:opacity-50";
const inputCls =
  "w-full rounded-[12px] border border-[#E5E7EB] bg-white px-2 py-1.5 text-[14px] text-[#111111] outline-none transition focus:border-[#2563EB]";

function formatMoney(n: number) {
  return `${n.toLocaleString("uk-UA", { maximumFractionDigits: 2 })} ₴`;
}

function formatPct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function formatDateTime(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type EstimateViewMode =
  | "base"
  | "commercial"
  | "cost"
  | "structure"
  | "versions";

function modalModeToDomainPricingMode(modal: string): string {
  const m: Record<string, string> = {
    manual: "manual",
    by_qty: "quantity",
    by_area: "area",
    running_meter: "length",
    module: "module",
    custom_formula: "formula",
  };
  return m[modal] ?? "quantity";
}

function domainPricingModeToModal(
  domain: string | null | undefined,
): string {
  if (!domain) return "by_qty";
  const m: Record<string, string> = {
    manual: "manual",
    quantity: "by_qty",
    area: "by_area",
    length: "running_meter",
    module: "module",
    formula: "custom_formula",
    by_qty: "by_qty",
    by_area: "by_area",
    running_meter: "running_meter",
    custom_formula: "custom_formula",
  };
  return m[domain] ?? "by_qty";
}

function legacyPricingFromModal(
  modal: string,
): NonNullable<EstimateLineWorkspaceMeta["calculationMode"]> {
  const map: Record<
    string,
    NonNullable<EstimateLineWorkspaceMeta["calculationMode"]>
  > = {
    manual: "manual",
    by_qty: "by_qty",
    by_area: "by_area",
    running_meter: "running_meter",
    module: "module",
    custom_formula: "custom_formula",
  };
  return map[modal] ?? "by_qty";
}

function sectionSubtotal(lines: LineModel[], sectionId: string | null) {
  return lines
    .filter((l) => l.sectionId === sectionId)
    .reduce((a, l) => a + l.amountSale, 0);
}

export type DealEstimateWorkspaceProps = {
  dealId: string;
  dealTitle: string;
  estimateVisibility: EstimateVisibility;
  /** Для синхронізації суми угоди з сметою (кнопка над таблицею). */
  workspacePayload?: DealWorkspacePayload;
};

export function DealEstimateWorkspace({
  dealId,
  dealTitle,
  estimateVisibility,
  workspacePayload,
}: DealEstimateWorkspaceProps) {
  const router = useRouter();
  const ws = useDealEstimateWorkspace(dealId);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareOther, setCompareOther] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [formulaLine, setFormulaLine] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<EstimateViewMode>("base");
  const [supplierPickerLineId, setSupplierPickerLineId] = useState<
    string | null
  >(null);

  const canSeeCost = estimateVisibility !== "sales";
  const showCost = canSeeCost && viewMode !== "commercial";
  const showMargin = canSeeCost && viewMode !== "commercial";

  const activeRow = ws.list.find((x) => x.id === ws.activeId);
  const sortedSections = useMemo(
    () =>
      ws.snap
        ? [...ws.snap.sections].sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    [ws.snap],
  );

  const panelWarnings = useMemo(() => ws.warnings.slice(0, 16), [ws.warnings]);
  const activeVersion = useMemo(
    () => ws.list.find((x) => x.id === ws.activeId) ?? null,
    [ws.list, ws.activeId],
  );
  const managerName = useMemo(() => {
    const settings = ws.snap?.settings as unknown as Record<string, unknown> | undefined;
    const raw = settings?.responsibleManagerName;
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }, [ws.snap?.settings]);
  const estimateInsights = useMemo(
    () => buildEstimateInsights(ws.snap?.lines ?? [], ws.totals.discount, panelWarnings),
    [ws.snap?.lines, ws.totals.discount, panelWarnings],
  );
  const warningByLineId = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of panelWarnings) {
      if (w.scope === "item" && w.itemId && !map.has(w.itemId)) {
        map.set(w.itemId, w.message);
      }
    }
    return map;
  }, [panelWarnings]);

  const onSelectVersion = useCallback(
    (id: string) => {
      void ws.selectVersion(id);
    },
    [ws],
  );

  const openCompare = useCallback(() => {
    if (!ws.activeId || !compareOther) return;
    setCompareOpen(true);
  }, [ws.activeId, compareOther]);

  const goProposalTab = useCallback(
    (note: string) => {
      const q = new URLSearchParams();
      q.set("tab", "proposal");
      if (note) q.set("estimateNote", encodeURIComponent(note.slice(0, 500)));
      router.push(`/deals/${dealId}/workspace?${q.toString()}`);
    },
    [dealId, router],
  );

  if (ws.loading && !ws.snap) {
    return (
      <div className={cn("min-h-[320px] p-4", bg)}>
        <p className={muted}>Завантаження розрахунку…</p>
      </div>
    );
  }

  if (!ws.loading && ws.list.length === 0) {
    return (
      <div className={cn("p-4", bg)}>
        <div className={cn(card, "p-8 text-center")}>
          <h2 className={cn("text-[24px] font-semibold", text)}>
            Розрахунок ще не створено
          </h2>
          <p className={cn("mt-2 text-[14px]", muted)}>
            Створіть першу версію комерційного розрахунку для угоди «{dealTitle}
            ».
          </p>
          <button
            type="button"
            className={cn(btnPrimary, "mt-6")}
            onClick={() => void ws.newVersion()}
          >
            Створити розрахунок
          </button>
        </div>
      </div>
    );
  }

  const showDealValueSync =
    workspacePayload &&
    ws.list.length > 0 &&
    canSyncDealValueFromLatestEstimate(workspacePayload);

  return (
    <div className={cn("flex min-h-[calc(100vh-180px)] flex-col", bg)}>
      {showDealValueSync ? (
        <div className="mx-4 mt-2 shrink-0 rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2.5 shadow-sm">
          <p className="text-[11px] leading-relaxed text-amber-950">
            <span className="font-semibold">Сума в шапці угоди</span> не збігається з
            останньою сметою (або не задана). Підставте для договору, КП та
            звітів.
          </p>
          <SyncDealValueFromEstimateButton
            data={workspacePayload}
            tone="amber"
            className="mt-2"
          />
        </div>
      ) : null}
      {/* Sticky top bar */}
      <header className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-[#FAFAFA]/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={cn(
                  inputCls,
                  "max-w-md border-transparent bg-transparent px-0 text-[24px] font-semibold",
                )}
                value={ws.snap?.name ?? ""}
                placeholder="Назва розрахунку"
                onChange={(e) =>
                  ws.patchHeader({ name: e.target.value || null })
                }
              />
              {activeRow ? (
                <span className="rounded-full border border-[#E5E7EB] bg-white px-2.5 py-0.5 text-[12px] font-medium text-[#2563EB]">
                  v{activeRow.version}
                </span>
              ) : null}
              {activeRow?.isActive ? (
                <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[12px] font-medium text-[#16A34A]">
                  Активна
                </span>
              ) : (
                <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[12px] font-medium text-[#6B7280]">
                  Чернетка
                </span>
              )}
              {activeRow?.status === "SUPERSEDED" ? (
                <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[12px] text-[#92400E]">
                  Архів
                </span>
              ) : null}
            </div>
            <p className={cn("mt-1 text-[12px]", muted)}>
              {ws.saveState === "saving"
                ? "Збереження…"
                : ws.saveState === "dirty"
                  ? "Незбережені зміни…"
                  : "Збережено"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={cn(inputCls, "w-auto min-w-[140px]")}
              value={ws.activeId ?? ""}
              onChange={(e) => onSelectVersion(e.target.value)}
            >
              {ws.list.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version}
                  {v.isActive ? " · активна" : ""} ·{" "}
                  {v.totalPrice != null ? formatMoney(v.totalPrice) : "—"}
                </option>
              ))}
            </select>
            <select
              className={cn(inputCls, "w-auto min-w-[120px]")}
              value={compareOther ?? ""}
              onChange={(e) => setCompareOther(e.target.value || null)}
            >
              <option value="">Порівняти з…</option>
              {ws.list
                .filter((x) => x.id !== ws.activeId)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className={btnSecondary}
              disabled={!compareOther}
              onClick={openCompare}
            >
              Порівняти
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => void ws.newVersion()}
            >
              Нова версія
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => void ws.duplicateVersion()}
            >
              Дублювати
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => void ws.setActiveVersion()}
            >
              Зробити активною
            </button>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => setQuoteOpen(true)}
            >
              Згенерувати КП
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2">
            <p className={cn("text-[11px] uppercase tracking-wide", muted)}>Продаж</p>
            <p className="text-[18px] font-semibold text-[#2563EB]">{formatMoney(ws.totals.grand)}</p>
            <p className={cn("text-[11px]", muted)}>рядки: {formatMoney(ws.totals.sumSale)}</p>
          </div>
          <div className="rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2">
            <p className={cn("text-[11px] uppercase tracking-wide", muted)}>Собівартість</p>
            <p className="text-[18px] font-semibold text-[#111111]">{formatMoney(ws.totals.sumCost)}</p>
            <p className={cn("text-[11px]", muted)}>доставка+монтаж: {formatMoney(ws.totals.delivery + ws.totals.install)}</p>
          </div>
          <div className="rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2">
            <p className={cn("text-[11px] uppercase tracking-wide", muted)}>Маржа</p>
            <p className={cn("text-[18px] font-semibold", ws.totals.margin < 0 ? "text-[#DC2626]" : "text-[#16A34A]")}>
              {formatMoney(ws.totals.margin)}
            </p>
            <p className={cn("text-[11px]", muted)}>
              {formatPct(ws.totals.grand > 0 ? (ws.totals.margin / ws.totals.grand) * 100 : null)}
            </p>
          </div>
          <div className="rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2">
            <p className={cn("text-[11px] uppercase tracking-wide", muted)}>Контроль</p>
            <p className="text-[13px] font-medium text-[#111111]">
              Оновлено: {formatDateTime(activeVersion?.updatedAt)}
            </p>
            <p className={cn("text-[11px]", muted)}>
              Менеджер: {managerName ?? "—"} · Знижка: {formatMoney(ws.totals.discount)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[12px] border border-[#E5E7EB] bg-white p-2">
          {(
            [
              ["base", "Base"],
              ["commercial", "Commercial"],
              ["cost", "Cost"],
              ["structure", "Structure"],
              ["versions", "Versions"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                "rounded-[10px] px-3 py-1.5 text-[12px] font-medium transition",
                viewMode === id
                  ? "bg-[#2563EB] text-white shadow-sm"
                  : "border border-[#E5E7EB] bg-white text-[#111111] hover:bg-[#F3F4F6]",
              )}
              onClick={() => setViewMode(id)}
            >
              {label}
            </button>
          ))}
          <span className={cn("ml-auto text-[12px]", muted)}>
            Режим: {viewMode === "base" ? "Звичний" : viewMode}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[#E5E7EB] pt-3">
          <button
            type="button"
            className={btnSecondary}
            onClick={() => void ws.saveNow()}
          >
            Зберегти зараз
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={!ws.canUndo}
            onClick={() => ws.undo()}
          >
            Назад
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={!ws.canRedo}
            onClick={() => ws.redo()}
          >
            Вперед
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => setQuickOpen((x) => !x)}
          >
            Швидке додавання
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => ws.addSection()}
          >
            + Секція
          </button>
        </div>
        {quickOpen ? (
          <div className="mt-3 flex flex-wrap gap-2 rounded-[12px] border border-[#E5E7EB] bg-white p-3 text-[14px]">
            <span className={muted}>Шаблони:</span>
            {UKR_PRODUCT_QUICK_TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                className="rounded-[12px] border border-[#E5E7EB] px-2 py-1 text-[12px] hover:bg-[#FAFAFA]"
                onClick={() => {
                  const sid = sortedSections[0]?.id ?? null;
                  ws.addLine(sid, t.type, t.name);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {ws.error ? (
        <p className="mx-4 mt-2 rounded-[12px] bg-red-50 px-3 py-2 text-[14px] text-[#DC2626]">
          {ws.error}
        </p>
      ) : null}

      {viewMode === "versions" ? (
        <div className="px-4 pt-3">
          <EstimateVersionComparisonCard
            dealId={dealId}
            activeId={ws.activeId}
            compareWithId={compareOther ?? ws.list.find((v) => v.id !== ws.activeId)?.id ?? null}
          />
        </div>
      ) : null}

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        {/* Left: sections */}
        <aside className={cn(card, "h-fit p-3 lg:sticky lg:top-[120px] lg:max-h-[calc(100vh-140px)] lg:overflow-auto")}>
          <p className={cn("text-[12px] font-medium uppercase tracking-wide", muted)}>
            Структура
          </p>
          <ul className="mt-3 space-y-1">
            {sortedSections.map((sec, idx) => {
              const sub = sectionSubtotal(ws.snap?.lines ?? [], sec.id);
              return (
                <li key={sec.id}>
                  <div className="flex items-start justify-between gap-2 rounded-[12px] px-2 py-2 transition hover:bg-[#FAFAFA]">
                    <div className="min-w-0 flex-1">
                      <input
                        className={cn(inputCls, "border-0 bg-transparent px-0 py-0 text-[14px] font-medium")}
                        value={sec.title}
                        onChange={(e) =>
                          ws.updateSection(sec.id, { title: e.target.value })
                        }
                      />
                      <p className={cn("text-[12px]", muted)}>
                        {ws.snap?.lines.filter((l) => l.sectionId === sec.id).length ?? 0}{" "}
                        поз. · {formatMoney(sub)}
                      </p>
                      {showMargin ? (
                        <p className="text-[11px] text-[#6B7280]">
                          Маржа секції:{" "}
                          {formatMoney(
                            (ws.snap?.lines
                              .filter((l) => l.sectionId === sec.id)
                              .reduce(
                                (acc, l) =>
                                  acc + (l.amountSale - (l.amountCost ?? 0)),
                                0,
                              ) ?? 0),
                          )}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        className="text-[11px] text-[#2563EB]"
                        onClick={() =>
                          setCollapsed((c) => ({
                            ...c,
                            [sec.id]: !c[sec.id],
                          }))
                        }
                      >
                        {collapsed[sec.id] ? "Розгорнути" : "Згорнути"}
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-[#DC2626]"
                        onClick={() => {
                          if (sortedSections.length <= 1) return;
                          if (
                            confirm(
                              "Видалити секцію? Позиції будуть перенесені в іншу секцію.",
                            )
                          )
                            ws.deleteSection(sec.id);
                        }}
                      >
                        Видалити
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-[#6B7280]"
                        disabled={idx === 0}
                        onClick={() => ws.reorderSection(idx, idx - 1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-[#6B7280]"
                        disabled={idx === sortedSections.length - 1}
                        onClick={() => ws.reorderSection(idx, idx + 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Center: grid */}
        <main className="min-w-0 space-y-6">
          {sortedSections.map((sec) => {
            const lines = (ws.snap?.lines ?? []).filter(
              (l) => l.sectionId === sec.id,
            );
            if (collapsed[sec.id]) {
              return (
                <div key={sec.id} className={cn(card, "p-4")}>
                  <button
                    type="button"
                    className={cn("text-[18px] font-medium", text)}
                    onClick={() =>
                      setCollapsed((c) => ({ ...c, [sec.id]: false }))
                    }
                  >
                    {sec.title} · згорнуто ({lines.length})
                  </button>
                </div>
              );
            }
            return (
              <section key={sec.id} className={cn(card, "overflow-hidden")}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3">
                  <h3 className={cn("text-[18px] font-medium", text)}>
                    {sec.title}
                  </h3>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => ws.addLine(sec.id)}
                  >
                    + Позиція
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-left text-[14px]">
                    <thead>
                      <tr className={cn("border-b border-[#E5E7EB] text-[12px]", muted)}>
                        <th className="px-3 py-2 font-medium">Назва</th>
                        <th className="px-3 py-2 font-medium">Тип</th>
                        <th className="px-3 py-2 font-medium">К-сть</th>
                        <th className="px-3 py-2 font-medium">Од.</th>
                        <th className="px-3 py-2 font-medium">Ціна</th>
                        {showCost ? (
                          <th className="px-3 py-2 font-medium">Собів.</th>
                        ) : null}
                        <th className="px-3 py-2 font-medium">Сума</th>
                        <th className="px-3 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((li) => (
                        <LineRow
                          key={li.id}
                          line={li}
                          showCost={showCost}
                          viewMode={viewMode}
                          warningText={warningByLineId.get(li.id)}
                          onChange={(patch) => ws.updateLine(li.id, patch)}
                          onMeta={(m) => ws.updateLineMeta(li.id, m)}
                          onDuplicate={() => ws.duplicateLine(li.id)}
                          onDelete={() => {
                            if (confirm("Видалити рядок?")) ws.deleteLine(li.id);
                          }}
                          onFormula={() => setFormulaLine(li.id)}
                          onPickSupplier={() => setSupplierPickerLineId(li.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-t border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3 text-[14px]">
                  <span className={muted}>Підсумок секції</span>
                  <span className="font-semibold text-[#111111]">
                    {formatMoney(sectionSubtotal(ws.snap?.lines ?? [], sec.id))}
                  </span>
                </div>
              </section>
            );
          })}
        </main>

        {/* Right: summary */}
        <aside className="lg:sticky lg:top-[120px] lg:h-fit">
          <div className={cn(card, "space-y-4 p-4")}>
            <h3 className={cn("text-[18px] font-medium", text)}>Підсумок</h3>
            <dl className="space-y-2 text-[14px]">
              <div className="flex justify-between">
                <dt className={muted}>Секцій</dt>
                <dd>{ws.totals.sectionCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className={muted}>Позицій</dt>
                <dd>{ws.totals.itemCount}</dd>
              </div>
              {showCost ? (
                <div className="flex justify-between">
                  <dt className={muted}>Собівартість</dt>
                  <dd>{formatMoney(ws.totals.sumCost)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className={muted}>Продаж (рядки)</dt>
                <dd>{formatMoney(ws.totals.sumSale)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className={muted}>Знижка</dt>
                <dd>
                  <input
                    type="number"
                    className={cn(inputCls, "w-28 text-right")}
                    value={ws.snap?.discountAmount ?? 0}
                    onChange={(e) =>
                      ws.patchHeader({
                        discountAmount: Number(e.target.value) || 0,
                      })
                    }
                  />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className={muted}>Доставка</dt>
                <dd>
                  <input
                    type="number"
                    className={cn(inputCls, "w-28 text-right")}
                    value={ws.snap?.deliveryCost ?? 0}
                    onChange={(e) =>
                      ws.patchHeader({
                        deliveryCost: Number(e.target.value) || 0,
                      })
                    }
                  />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className={muted}>Монтаж</dt>
                <dd>
                  <input
                    type="number"
                    className={cn(inputCls, "w-28 text-right")}
                    value={ws.snap?.installationCost ?? 0}
                    onChange={(e) =>
                      ws.patchHeader({
                        installationCost: Number(e.target.value) || 0,
                      })
                    }
                  />
                </dd>
              </div>
              {showMargin ? (
                <div className="flex justify-between border-t border-[#E5E7EB] pt-2">
                  <dt className={muted}>Маржа (оцінка)</dt>
                  <dd
                    className={
                      ws.totals.margin < 0 ? "text-[#DC2626]" : "text-[#16A34A]"
                    }
                  >
                    {formatMoney(ws.totals.margin)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-[#E5E7EB] pt-2 text-[18px] font-semibold">
                <dt className={text}>Всього</dt>
                <dd className="text-[#2563EB]">{formatMoney(ws.totals.grand)}</dd>
              </div>
            </dl>

            <div className="border-t border-[#E5E7EB] pt-3">
              <p className={cn("text-[12px] font-medium uppercase", muted)}>
                Керування ціною
              </p>
              <label className="mt-2 block text-[12px]">
                <span className={muted}>Додаткова націнка %</span>
                <input
                  type="number"
                  className={cn(inputCls, "mt-1")}
                  value={ws.snap?.settings.extraMarginPct ?? ""}
                  placeholder="0"
                  onChange={(e) =>
                    ws.patchHeader({
                      settings: {
                        ...ws.snap!.settings,
                        extraMarginPct: Number(e.target.value) || 0,
                      },
                    })
                  }
                />
              </label>
              <label className="mt-2 block text-[12px]">
                <span className={muted}>ПДВ</span>
                <select
                  className={cn(inputCls, "mt-1")}
                  value={ws.snap?.settings.vatMode ?? "none"}
                  onChange={(e) =>
                    ws.patchHeader({
                      settings: {
                        ...ws.snap!.settings,
                        vatMode: e.target.value as "none" | "included" | "on_top",
                      },
                    })
                  }
                >
                  <option value="none">Без ПДВ</option>
                  <option value="included">Включено в ціну</option>
                  <option value="on_top">Зверху</option>
                </select>
              </label>
              <label className="mt-2 flex items-center gap-2 text-[14px]">
                <input
                  type="checkbox"
                  checked={ws.snap?.settings.hideInternalCostsInQuote ?? false}
                  onChange={(e) =>
                    ws.patchHeader({
                      settings: {
                        ...ws.snap!.settings,
                        hideInternalCostsInQuote: e.target.checked,
                      },
                    })
                  }
                />
                <span className={muted}>Приховати собівартість у КП</span>
              </label>
            </div>

            {panelWarnings.length > 0 ? (
              <div className="border-t border-[#E5E7EB] pt-3">
                <p className={cn("text-[12px] font-medium uppercase", muted)}>
                  Сигнали
                </p>
                <ul className="mt-2 space-y-1 text-[12px]">
                  {panelWarnings.map((w) => (
                    <li
                      key={w.id}
                      className={
                        w.severity === "danger"
                          ? "text-[#DC2626]"
                          : w.severity === "warning"
                            ? "text-[#F59E0B]"
                            : "text-[#6B7280]"
                      }
                    >
                      {w.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <label className="block text-[12px]">
              <span className={muted}>Нотатки розрахунку</span>
              <textarea
                className={cn(inputCls, "mt-1 min-h-[72px]")}
                value={ws.snap?.notes ?? ""}
                onChange={(e) =>
                  ws.patchHeader({ notes: e.target.value || null })
                }
              />
            </label>
          </div>
          <EstimateInsightPanel insights={estimateInsights} />
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-[#E5E7EB] bg-[#FAFAFA]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[14px] text-[#111111]">
          <span className={muted}>Разом</span>
          <div className="flex flex-wrap gap-4 font-semibold">
            <span className="text-[#2563EB]">
              {formatMoney(ws.totals.grand)}
            </span>
            {showMargin ? (
              <span
                className={
                  ws.totals.margin < 0 ? "text-[#DC2626]" : "text-[#16A34A]"
                }
              >
                Маржа {formatMoney(ws.totals.margin)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <MaterialSupplierPicker
        open={supplierPickerLineId != null}
        onOpenChange={(o) => !o && setSupplierPickerLineId(null)}
        favorites={ws.snap?.settings.favoriteSupplierCodes}
        recent={ws.snap?.settings.recentSupplierSearches}
        onSelect={(item: CatalogItemRecord) => {
          if (!supplierPickerLineId) return;
          ws.updateLineMeta(supplierPickerLineId, {
            v: 2,
            supplier: {
              supplierName: item.supplierName,
              supplierCode: item.itemCode,
              supplierItemName: item.itemName,
              supplierPrice: item.unitPrice,
              lastSyncAt: item.lastUpdated,
              manualOverride: false,
              catalogProviderId: item.supplierId,
              externalItemId: item.itemCode,
            },
          });
          ws.patchHeader({
            settings: {
              ...ws.snap!.settings,
              recentSupplierSearches: [
                item.itemCode,
                ...(ws.snap?.settings.recentSupplierSearches ?? []),
              ].slice(0, 12),
            },
          });
          setSupplierPickerLineId(null);
        }}
      />

      <EstimateCompareModal
        open={compareOpen}
        onOpenChange={setCompareOpen}
        dealId={dealId}
        fromId={compareOther}
        toId={ws.activeId}
      />

      <GenerateQuoteModal
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        sections={sortedSections}
        onConfirm={(opts) => {
          const payload = ws.buildQuotePayload({
            sectionIds: opts.sectionIds,
            includeBreakdown: opts.includeBreakdown,
            includeDelivery: opts.includeDelivery,
            includeInstallation: opts.includeInstallation,
          });
          if (payload && typeof window !== "undefined") {
            try {
              sessionStorage.setItem(
                "enver:quotePayload",
                JSON.stringify({
                  ...payload,
                  clientNote: opts.note.trim() || null,
                  hideInternalCosts:
                    ws.snap?.settings.hideInternalCostsInQuote ?? false,
                }),
              );
            } catch {
              /* ignore quota */
            }
          }
          const parts = [
            `КП з угоди · ${dealTitle}`,
            `Секції: ${opts.sectionIds.length}`,
            opts.includeBreakdown ? "з деталізацією" : "підсумки по секціях",
            opts.includeDelivery ? "доставка" : "",
            opts.includeInstallation ? "монтаж" : "",
            opts.note ? `Нотатка: ${opts.note}` : "",
          ];
          goProposalTab(parts.filter(Boolean).join(" · "));
        }}
      />

      <FormulaEditorModal
        open={formulaLine != null}
        onOpenChange={(o) => !o && setFormulaLine(null)}
        initialMode={
          formulaLine && ws.snap
            ? domainPricingModeToModal(
                parseWorkspaceMeta(
                  ws.snap.lines.find((l) => l.id === formulaLine)?.metadataJson,
                ).pricingMode ??
                  parseWorkspaceMeta(
                    ws.snap.lines.find((l) => l.id === formulaLine)?.metadataJson,
                  ).calculationMode,
              )
            : "by_qty"
        }
        onSave={(mode, label) => {
          if (!formulaLine) return;
          const pricingMode = modalModeToDomainPricingMode(mode);
          ws.updateLineMeta(formulaLine, {
            v: 2,
            pricingMode,
            calculationMode: legacyPricingFromModal(mode),
            formulaLabel: label || null,
          });
        }}
      />
    </div>
  );
}

function LineRow({
  line,
  showCost,
  viewMode,
  warningText,
  onChange,
  onMeta,
  onDuplicate,
  onDelete,
  onFormula,
  onPickSupplier,
}: {
  line: LineModel;
  showCost: boolean;
  viewMode: EstimateViewMode;
  warningText?: string;
  onChange: (p: Partial<LineModel>) => void;
  onMeta: (m: Partial<EstimateLineWorkspaceMeta>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFormula: () => void;
  onPickSupplier: () => void;
}) {
  const m = parseWorkspaceMeta(line.metadataJson);
  const marginPct =
    showCost && line.amountCost != null && line.amountSale > 0
      ? ((line.amountSale - line.amountCost) / line.amountSale) * 100
      : null;
  const hasBreakdown = Boolean(
    (line.metadataJson as Record<string, unknown> | undefined)?.breakdown,
  );
  const badges: Array<{ label: string; tone?: "warn" | "ok" | "muted" }> = [];
  if (m.pricingMode === "manual" || m.calculationMode === "manual") badges.push({ label: "Manual", tone: "muted" });
  if ((line.costPrice ?? 0) <= 0) badges.push({ label: "No cost", tone: "warn" });
  if (marginPct != null && marginPct < 12) badges.push({ label: "Low margin", tone: "warn" });
  if (m.clientVisible === false) badges.push({ label: "Hidden from quote", tone: "muted" });
  if (hasBreakdown) badges.push({ label: "Has breakdown", tone: "ok" });
  if (m.supplier?.supplierName || m.supplier?.supplierCode) badges.push({ label: "Supplier linked", tone: "ok" });
  if (warningText) badges.push({ label: "Warning", tone: "warn" });
  if (m.rowTag?.trim()) badges.push({ label: m.rowTag.trim(), tone: "muted" });

  return (
    <>
      <tr className="border-b border-[#E5E7EB] transition hover:bg-[#FAFAFA]">
        <td className="px-3 py-2 align-top">
          <input
            className={cn(inputCls, "min-w-[180px]")}
            value={line.productName}
            onChange={(e) => onChange({ productName: e.target.value })}
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {badges.slice(0, 5).map((b) => (
              <span
                key={b.label}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  b.tone === "warn"
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : b.tone === "ok"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 bg-slate-100 text-slate-600",
                )}
              >
                {b.label}
              </span>
            ))}
          </div>
        </td>
        <td className="px-3 py-2 align-top">
          <select
            className={inputCls}
            value={line.type}
            onChange={(e) =>
              onChange({ type: e.target.value as EstimateLineType })
            }
          >
            {Object.entries(LINE_TYPE_LABELS).map(([k, lab]) => (
              <option key={k} value={k}>
                {lab}
              </option>
            ))}
          </select>
        </td>
        <td className="px-3 py-2 align-top">
          <input
            type="number"
            className={cn(inputCls, "w-20")}
            value={line.qty}
            onChange={(e) =>
              onChange({ qty: Number(e.target.value) || 0 })
            }
          />
        </td>
        <td className="px-3 py-2 align-top">
          <input
            className={cn(inputCls, "w-16")}
            value={line.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
          />
        </td>
        <td className="px-3 py-2 align-top">
          <input
            type="number"
            className={cn(inputCls, "w-24")}
            value={line.salePrice}
            onChange={(e) =>
              onChange({ salePrice: Number(e.target.value) || 0 })
            }
          />
        </td>
        {showCost ? (
          <td className="px-3 py-2 align-top">
            <input
              type="number"
              className={cn(inputCls, "w-24")}
              value={line.costPrice ?? ""}
              placeholder="—"
              onChange={(e) => {
                const v = e.target.value;
                onChange({
                  costPrice: v === "" ? null : Number(v) || 0,
                });
              }}
            />
          </td>
        ) : null}
        <td className="px-3 py-2 align-top font-medium">
          {formatMoney(line.amountSale)}
          {showCost && marginPct != null && viewMode !== "commercial" ? (
            <div className={cn("text-[11px]", marginPct < 12 ? "text-amber-600" : "text-emerald-600")}>
              Маржа: {formatPct(marginPct)}
            </div>
          ) : null}
        </td>
        <td className="px-3 py-2 align-top">
          <div className="flex flex-col gap-1">
            <button type="button" className="text-[11px] text-[#2563EB]" onClick={onFormula}>
              Режим
            </button>
            <button type="button" className="text-[11px] text-[#6B7280]" onClick={onDuplicate}>
              Дубль
            </button>
            <button type="button" className="text-[11px] text-[#DC2626]" onClick={onDelete}>
              Видалити
            </button>
          </div>
        </td>
      </tr>
      <tr className="border-b border-[#E5E7EB] bg-[#FAFAFA]/80">
        <td colSpan={showCost ? 8 : 7} className="px-3 py-2 text-[12px]">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className={muted}>
              Матеріал
              <input
                className={cn(inputCls, "mt-0.5")}
                value={m.material ?? ""}
                onChange={(e) => onMeta({ material: e.target.value })}
              />
            </label>
            <label className={muted}>
              Фасад
              <input
                className={cn(inputCls, "mt-0.5")}
                value={m.facade ?? ""}
                onChange={(e) => onMeta({ facade: e.target.value })}
              />
            </label>
            <label className={muted}>
              Ш×В×Г (мм)
              <div className="mt-0.5 flex gap-1">
                <input
                  type="number"
                  className={inputCls}
                  placeholder="Ш"
                  value={m.widthMm ?? ""}
                  onChange={(e) =>
                    onMeta({
                      widthMm: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
                <input
                  type="number"
                  className={inputCls}
                  placeholder="В"
                  value={m.heightMm ?? ""}
                  onChange={(e) =>
                    onMeta({
                      heightMm: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
                <input
                  type="number"
                  className={inputCls}
                  placeholder="Г"
                  value={m.depthMm ?? ""}
                  onChange={(e) =>
                    onMeta({
                      depthMm: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </div>
            </label>
            <label className={muted}>
              Постачальник / код
              <div className="mt-0.5 flex gap-1">
                <input
                  className={cn(inputCls, "flex-1")}
                  value={m.supplier?.supplierName ?? line.supplierRef ?? ""}
                  onChange={(e) =>
                    onMeta({
                      supplier: {
                        ...m.supplier,
                        supplierName: e.target.value,
                        manualOverride: true,
                      },
                    })
                  }
                />
                <button
                  type="button"
                  className="shrink-0 rounded-[12px] border border-[#E5E7EB] px-2 py-1.5 text-[12px] text-[#2563EB]"
                  onClick={onPickSupplier}
                >
                  Каталог
                </button>
              </div>
            </label>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label className={muted}>
              Видимість у КП
              <select
                className={cn(inputCls, "mt-0.5")}
                value={m.clientVisible === false ? "hidden" : "visible"}
                onChange={(e) => onMeta({ clientVisible: e.target.value !== "hidden" })}
              >
                <option value="visible">Visible in quote</option>
                <option value="hidden">Hidden from quote</option>
              </select>
            </label>
            <label className={muted}>
              Production note
              <input
                className={cn(inputCls, "mt-0.5")}
                value={m.productionNote ?? ""}
                onChange={(e) => onMeta({ productionNote: e.target.value || null })}
              />
            </label>
            <label className={muted}>
              Purchase note
              <input
                className={cn(inputCls, "mt-0.5")}
                value={m.purchaseNote ?? ""}
                onChange={(e) => onMeta({ purchaseNote: e.target.value || null })}
              />
            </label>
          </div>
          <label className={cn("mt-2 block", muted)}>
            Коментар
            <input
              className={cn(inputCls, "mt-0.5")}
              value={line.notes ?? ""}
              onChange={(e) => onChange({ notes: e.target.value || null })}
            />
          </label>
          {warningText ? (
            <p className="mt-1 rounded-[10px] border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              {warningText}
            </p>
          ) : null}
        </td>
      </tr>
    </>
  );
}

type EstimateInsight = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  quickAction: string;
};

function buildEstimateInsights(
  lines: LineModel[],
  discountAmount: number,
  warnings: Array<{ id: string; message: string; severity: string }>,
): EstimateInsight[] {
  if (lines.length === 0) return [];
  const out: EstimateInsight[] = [];

  const missingCost = lines.filter((l) => (l.costPrice ?? 0) <= 0);
  if (missingCost.length > 0) {
    out.push({
      id: "missing-cost",
      severity: "warning",
      title: "Є позиції без собівартості",
      detail: `${missingCost.length} рядків без cost. Це спотворює маржу.`,
      quickAction: "Review line",
    });
  }

  const lowMargin = lines.filter((l) => {
    if (l.amountSale <= 0 || l.amountCost == null) return false;
    return ((l.amountSale - l.amountCost) / l.amountSale) * 100 < 12;
  });
  if (lowMargin.length > 0) {
    out.push({
      id: "low-margin",
      severity: "critical",
      title: "Низька маржа на позиціях",
      detail: `${lowMargin.length} рядків нижче порога 12%.`,
      quickAction: "Open breakdown",
    });
  }

  const manual = lines.filter((l) => {
    const m = parseWorkspaceMeta(l.metadataJson);
    return (
      m.pricingMode === "manual" ||
      m.calculationMode === "manual" ||
      m.isManualOverride === true
    );
  });
  if (manual.length > 0) {
    out.push({
      id: "manual-overrides",
      severity: "info",
      title: "Ручні оверрайди ціни",
      detail: `${manual.length} рядків із manual override.`,
      quickAction: "Review line",
    });
  }

  const names = new Map<string, number>();
  for (const line of lines) {
    const key = line.productName.trim().toLowerCase();
    if (!key) continue;
    names.set(key, (names.get(key) ?? 0) + 1);
  }
  const dupCount = [...names.values()].filter((x) => x > 1).length;
  if (dupCount > 0) {
    out.push({
      id: "duplicates",
      severity: "warning",
      title: "Можливі дублікати",
      detail: `Виявлено ${dupCount} груп схожих/дублікатних рядків.`,
      quickAction: "Compare with previous version",
    });
  }

  const biggestCost = [...lines]
    .sort((a, b) => (b.amountCost ?? 0) - (a.amountCost ?? 0))
    .slice(0, 1)[0];
  if (biggestCost && (biggestCost.amountCost ?? 0) > 0) {
    out.push({
      id: "biggest-cost-driver",
      severity: "info",
      title: "Найбільший cost driver",
      detail: `${biggestCost.productName}: ${formatMoney(biggestCost.amountCost ?? 0)}.`,
      quickAction: "Open breakdown",
    });
  }

  if (discountAmount > 0 && warnings.length === 0) {
    out.push({
      id: "discount-note",
      severity: "warning",
      title: "Знижка без пояснення",
      detail: `Застосовано знижку ${formatMoney(discountAmount)} без явного ризик-коментаря.`,
      quickAction: "Add internal note",
    });
  }

  return out.slice(0, 8);
}

function EstimateInsightPanel({ insights }: { insights: EstimateInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <div className={cn(card, "mt-4 space-y-3 p-4")}>
      <h4 className={cn("text-[16px] font-semibold", text)}>Smart insights</h4>
      <ul className="space-y-2">
        {insights.map((ins) => (
          <li
            key={ins.id}
            className={cn(
              "rounded-[12px] border px-3 py-2 text-[12px]",
              ins.severity === "critical"
                ? "border-red-200 bg-red-50"
                : ins.severity === "warning"
                  ? "border-amber-200 bg-amber-50"
                  : "border-blue-200 bg-blue-50",
            )}
          >
            <p className="font-semibold text-[#111111]">{ins.title}</p>
            <p className="mt-0.5 text-[#4B5563]">{ins.detail}</p>
            <p className="mt-1 text-[11px] text-[#1D4ED8]">Quick action: {ins.quickAction}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EstimateVersionComparisonCard({
  dealId,
  activeId,
  compareWithId,
}: {
  dealId: string;
  activeId: string | null;
  compareWithId: string | null;
}) {
  const [data, setData] = useState<CompareEstimateVersionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId || !compareWithId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const r = await fetch(
          `/api/deals/${dealId}/estimates/compare?from=${encodeURIComponent(compareWithId)}&to=${encodeURIComponent(activeId)}`,
        );
        const j = (await r.json()) as CompareEstimateVersionsResult & { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Помилка порівняння");
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Помилка");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dealId, activeId, compareWithId]);

  if (!activeId || !compareWithId) {
    return (
      <div className={cn(card, "p-3 text-[12px]", muted)}>
        Для Versions mode оберіть версію у полі «Порівняти з…».
      </div>
    );
  }

  if (loading) {
    return <div className={cn(card, "p-3 text-[12px]", muted)}>Аналіз змін версій…</div>;
  }
  if (error) {
    return <div className="rounded-[12px] border border-red-200 bg-red-50 p-3 text-[12px] text-[#B91C1C]">{error}</div>;
  }
  if (!data) return null;

  const topReasons = data.changedItems.slice(0, 3).map((c) => {
    const main = c.fields.find((f) => f.field === "total") ?? c.fields[0];
    return `• ${c.title}: ${main ? `${main.from} → ${main.to}` : "оновлено"}`;
  });

  return (
    <div className={cn(card, "p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className={cn("text-[16px] font-semibold", text)}>What changed</h4>
        <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] text-[#4338CA]">
          v{data.fromVersion.versionNumber} → v{data.toVersion.versionNumber}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <StatMini label="Added" value={String(data.summary.added)} />
        <StatMini label="Removed" value={String(data.summary.removed)} />
        <StatMini label="Changed" value={String(data.summary.changed)} />
        <StatMini label="Total delta" value={formatMoney(data.summary.totalDelta)} />
      </div>
      {topReasons.length > 0 ? (
        <div className="mt-3 rounded-[10px] border border-[#E5E7EB] bg-[#FAFAFA] p-3 text-[12px] text-[#374151]">
          {topReasons.map((x) => (
            <p key={x}>{x}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[#E5E7EB] bg-white px-2 py-1.5">
      <p className={cn("text-[10px] uppercase tracking-wide", muted)}>{label}</p>
      <p className="text-[13px] font-semibold text-[#111111]">{value}</p>
    </div>
  );
}
