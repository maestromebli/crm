"use client";

import { create } from "zustand";
import type { CalculationAISuggestion } from "../calculation-ai/calculationAIEngine";

export type CalculationRowType = "material" | "fitting" | "service" | "measurement";

export type CalculationRow = {
  id: string;
  sourceLineId: string | null;
  sectionId: string | null;
  name: string;
  type: CalculationRowType;
  qty: number;
  coeff: number;
  price: number;
  amount: number;
  unit: string;
  selected: boolean;
};

export type CalculationTotals = {
  costTotal: number;
  saleTotal: number;
  marginAmount: number;
  marginPercent: number;
  measurementCost: number;
  finalTotal: number;
  markupPercent: number;
};

export type CalculationStoreState = {
  rows: CalculationRow[];
  totals: CalculationTotals;
  version: string;
  aiSuggestions: CalculationAISuggestion[];
  setRows: (rows: CalculationRow[]) => void;
  setVersion: (version: string) => void;
  setMarkupPercent: (markupPercent: number) => void;
  setAISuggestions: (items: CalculationAISuggestion[]) => void;
  addRow: (row?: Partial<CalculationRow>) => void;
  updateRow: (rowId: string, patch: Partial<CalculationRow>) => void;
  deleteRow: (rowId: string) => void;
  duplicateRow: (rowId: string) => void;
  reorderRows: (from: number, to: number) => void;
  toggleSelect: (rowId: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  recalcTotals: () => void;
  applyAISuggestion: (suggestion: CalculationAISuggestion) => void;
};

function newRowId() {
  return `calc_${crypto.randomUUID()}`;
}

function safeNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function calcAmount(row: CalculationRow): number {
  return safeNumber(row.qty, 0) * safeNumber(row.coeff, 1) * safeNumber(row.price, 0);
}

function computeTotals(rows: CalculationRow[], markupPercent: number): CalculationTotals {
  const saleTotal = rows.reduce((acc, row) => acc + calcAmount(row), 0);
  const measurementCost = rows
    .filter((x) => x.type === "measurement")
    .reduce((acc, row) => acc + calcAmount(row), 0);
  const costTotal = saleTotal * 0.74;
  const marginAmount = saleTotal - costTotal;
  const marginPercent = saleTotal > 0 ? (marginAmount / saleTotal) * 100 : 0;
  const finalTotal = saleTotal * (1 + safeNumber(markupPercent, 0) / 100);
  return {
    costTotal,
    saleTotal,
    marginAmount,
    marginPercent,
    measurementCost,
    finalTotal,
    markupPercent: safeNumber(markupPercent, 0),
  };
}

function defaultRow(partial?: Partial<CalculationRow>): CalculationRow {
  const row: CalculationRow = {
    id: partial?.id ?? newRowId(),
    sourceLineId: partial?.sourceLineId ?? null,
    sectionId: partial?.sectionId ?? null,
    name: partial?.name ?? "",
    type: partial?.type ?? "material",
    qty: partial?.qty ?? 1,
    coeff: partial?.coeff ?? 1,
    price: partial?.price ?? 0,
    amount: 0,
    unit: partial?.unit ?? "шт",
    selected: partial?.selected ?? false,
  };
  return { ...row, amount: calcAmount(row) };
}

const INITIAL_ROWS: CalculationRow[] = [defaultRow({ name: "Корпус", price: 0 })];

const INITIAL_TOTALS = computeTotals(INITIAL_ROWS, 0);

export const useCalculationStore = create<CalculationStoreState>((set, get) => ({
  rows: INITIAL_ROWS,
  totals: INITIAL_TOTALS,
  version: "v1",
  aiSuggestions: [],
  setRows: (rows) =>
    set((state) => {
      const nextRows = rows.map((row) => ({ ...row, amount: calcAmount(row) }));
      return {
        rows: nextRows,
        totals: computeTotals(nextRows, state.totals.markupPercent),
      };
    }),
  setVersion: (version) => set(() => ({ version })),
  setMarkupPercent: (markupPercent) =>
    set((state) => ({
      totals: computeTotals(state.rows, markupPercent),
    })),
  setAISuggestions: (items) => set(() => ({ aiSuggestions: items })),
  addRow: (row) =>
    set((state) => {
      const nextRows = [...state.rows, defaultRow(row)];
      return {
        rows: nextRows,
        totals: computeTotals(nextRows, state.totals.markupPercent),
      };
    }),
  updateRow: (rowId, patch) =>
    set((state) => {
      const nextRows = state.rows.map((row) =>
        row.id === rowId ? { ...row, ...patch, amount: calcAmount({ ...row, ...patch }) } : row,
      );
      return {
        rows: nextRows,
        totals: computeTotals(nextRows, state.totals.markupPercent),
      };
    }),
  deleteRow: (rowId) =>
    set((state) => {
      const nextRows = state.rows.filter((row) => row.id !== rowId);
      return {
        rows: nextRows.length > 0 ? nextRows : [defaultRow()],
        totals: computeTotals(nextRows.length > 0 ? nextRows : [defaultRow()], state.totals.markupPercent),
      };
    }),
  duplicateRow: (rowId) =>
    set((state) => {
      const source = state.rows.find((row) => row.id === rowId);
      if (!source) return state;
      const nextRows = [
        ...state.rows,
        defaultRow({
          ...source,
          id: newRowId(),
          sourceLineId: source.sourceLineId,
          selected: false,
          name: `${source.name} (копія)`,
        }),
      ];
      return {
        rows: nextRows,
        totals: computeTotals(nextRows, state.totals.markupPercent),
      };
    }),
  reorderRows: (from, to) =>
    set((state) => {
      if (from === to || from < 0 || to < 0 || from >= state.rows.length || to >= state.rows.length) {
        return state;
      }
      const nextRows = [...state.rows];
      const [moved] = nextRows.splice(from, 1);
      if (!moved) return state;
      nextRows.splice(to, 0, moved);
      return {
        rows: nextRows,
        totals: computeTotals(nextRows, state.totals.markupPercent),
      };
    }),
  toggleSelect: (rowId) =>
    set((state) => ({
      rows: state.rows.map((row) =>
        row.id === rowId ? { ...row, selected: !row.selected } : row,
      ),
    })),
  clearSelection: () =>
    set((state) => ({
      rows: state.rows.map((row) => ({ ...row, selected: false })),
    })),
  selectAll: () =>
    set((state) => ({
      rows: state.rows.map((row) => ({ ...row, selected: true })),
    })),
  recalcTotals: () =>
    set((state) => ({
      rows: state.rows.map((row) => ({ ...row, amount: calcAmount(row) })),
      totals: computeTotals(state.rows, state.totals.markupPercent),
    })),
  applyAISuggestion: (suggestion) =>
    set((state) => {
      if (!suggestion.patch || !suggestion.rowId) return state;
      const nextRows = state.rows.map((row) =>
        row.id === suggestion.rowId
          ? {
              ...row,
              ...suggestion.patch,
              amount: calcAmount({ ...row, ...suggestion.patch }),
            }
          : row,
      );
      return {
        rows: nextRows,
        totals: computeTotals(nextRows, state.totals.markupPercent),
      };
    }),
}));
