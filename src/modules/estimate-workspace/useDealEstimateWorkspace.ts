"use client";

import type { EstimateLineType } from "@prisma/client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  mergeWorkspaceMeta,
  parseWorkspaceMeta,
} from "../../lib/estimate-workspace/line-meta";
import type { EstimateLineWorkspaceMeta } from "../../lib/estimate-workspace/types";
import {
  lineModelToEstimateItem,
  normalizeLineModel,
  sectionKeyToType,
  type LineModel,
  type SectionModel,
} from "../../features/estimate/mappers/line-domain-mapper";
import { calculateEstimateSummary } from "../../features/estimate/utils/calculations";
import { calculateWarnings } from "../../features/estimate/utils/warnings";
import type {
  EstimateItem,
  EstimateSummary,
  EstimateWarning,
} from "../../features/estimate/types/domain";
import {
  parseWorkspaceSettings,
  SETTINGS_JSON_V,
  type EstimateWorkspaceSettingsV2,
} from "../../features/estimate/utils/settings-json";
import { mapEstimateToQuotePayload } from "../../features/estimate/mappers/quote-payload";

export type { LineModel, SectionModel };

export type EstimateListItem = {
  id: string;
  version: number;
  status: string;
  isActive?: boolean;
  totalPrice: number | null;
  updatedAt?: string;
  changeSummary?: string | null;
};

function newId() {
  return crypto.randomUUID();
}

function lineFromApi(raw: Record<string, unknown>): LineModel {
  const meta =
    raw.metadataJson && typeof raw.metadataJson === "object"
      ? (raw.metadataJson as Record<string, unknown>)
      : {};
  return {
    id: String(raw.id ?? newId()),
    stableLineId: String(raw.stableLineId ?? raw.id ?? newId()),
    sectionId:
      raw.sectionId === null || raw.sectionId === undefined
        ? null
        : String(raw.sectionId),
    type: raw.type as EstimateLineType,
    category: raw.category ? String(raw.category) : null,
    code: raw.code ? String(raw.code) : null,
    productName: String(raw.productName ?? ""),
    qty: typeof raw.qty === "number" && Number.isFinite(raw.qty) ? raw.qty : 0,
    unit: String(raw.unit ?? "шт"),
    salePrice:
      typeof raw.salePrice === "number" && Number.isFinite(raw.salePrice)
        ? raw.salePrice
        : 0,
    costPrice:
      raw.costPrice === null || raw.costPrice === undefined
        ? null
        : typeof raw.costPrice === "number" && Number.isFinite(raw.costPrice)
          ? raw.costPrice
          : null,
    amountSale:
      typeof raw.amountSale === "number" && Number.isFinite(raw.amountSale)
        ? raw.amountSale
        : 0,
    amountCost:
      raw.amountCost === null || raw.amountCost === undefined
        ? null
        : typeof raw.amountCost === "number" && Number.isFinite(raw.amountCost)
          ? raw.amountCost
          : null,
    supplierRef: raw.supplierRef ? String(raw.supplierRef) : null,
    notes: raw.notes ? String(raw.notes) : null,
    metadataJson: { ...meta },
    sortOrder:
      typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
        ? raw.sortOrder
        : 0,
  };
}

function sectionFromApi(raw: Record<string, unknown>): SectionModel {
  return {
    id: String(raw.id),
    title: String(raw.title ?? ""),
    sortOrder:
      typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
        ? raw.sortOrder
        : 0,
    key: raw.key ? String(raw.key) : null,
  };
}

function ensureSettingsV2(
  raw: unknown,
): EstimateWorkspaceSettingsV2 {
  const p = parseWorkspaceSettings(raw);
  return { ...p, v: SETTINGS_JSON_V };
}

export type WorkspaceSnapshot = {
  name: string | null;
  sections: SectionModel[];
  lines: LineModel[];
  discountAmount: number;
  deliveryCost: number;
  installationCost: number;
  notes: string | null;
  changeSummary: string | null;
  settings: EstimateWorkspaceSettingsV2;
};

export function useDealEstimateWorkspace(dealId: string) {
  const [list, setList] = useState<EstimateListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">(
    "saved",
  );
  const [snap, setSnap] = useState<WorkspaceSnapshot | null>(null);
  const [past, setPast] = useState<WorkspaceSnapshot[]>([]);
  const [future, setFuture] = useState<WorkspaceSnapshot[]>([]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapRef = useRef<WorkspaceSnapshot | null>(null);
  snapRef.current = snap;
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/deals/${dealId}/estimates`);
      const j = (await r.json()) as {
        items?: Record<string, unknown>[];
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "Помилка завантаження");
      const items = (j.items ?? []).map((row) => ({
        id: String(row.id),
        version: Number(row.version ?? 1),
        status: String(row.status ?? "DRAFT"),
        isActive: Boolean(row.isActive),
        totalPrice:
          row.totalPrice === null || row.totalPrice === undefined
            ? null
            : Number(row.totalPrice),
        updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
        changeSummary: row.changeSummary
          ? String(row.changeSummary)
          : null,
      }));
      setList(items);
      setActiveId((cur) => {
        if (!cur && items[0]) return items[0]!.id;
        if (cur && !items.some((x) => x.id === cur) && items[0]) {
          return items[0]!.id;
        }
        return cur;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  const loadDetail = useCallback(
    async (estimateId: string) => {
      setError(null);
      try {
        const r = await fetch(`/api/deals/${dealId}/estimates/${estimateId}`);
        const j = (await r.json()) as {
          estimate?: Record<string, unknown>;
          error?: string;
        };
        if (!r.ok) throw new Error(j.error ?? "Помилка");
        const e = j.estimate;
        if (!e) throw new Error("Порожня відповідь");
        const sectionsRaw = Array.isArray(e.sections)
          ? (e.sections as Record<string, unknown>[])
          : [];
        const linesRaw = Array.isArray(e.lineItems)
          ? (e.lineItems as Record<string, unknown>[])
          : [];
        let sections = sectionsRaw.map(sectionFromApi);
        if (sections.length === 0) {
          const sid = newId();
          sections = [
            { id: sid, title: "Загальне", sortOrder: 0, key: "general" },
          ];
        }
        const rawLines = linesRaw.map(lineFromApi);
        const lines = rawLines.map((ln) =>
          normalizeLineModel(ln, estimateId),
        );
        const next: WorkspaceSnapshot = {
          name: e.name ? String(e.name) : null,
          sections,
          lines,
          discountAmount: Number(e.discountAmount ?? 0) || 0,
          deliveryCost: Number(e.deliveryCost ?? 0) || 0,
          installationCost: Number(e.installationCost ?? 0) || 0,
          notes: e.notes ? String(e.notes) : null,
          changeSummary: e.changeSummary ? String(e.changeSummary) : null,
          settings: ensureSettingsV2(e.settingsJson),
        };
        setSnap(next);
        setPast([]);
        setFuture([]);
        setSaveState("saved");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Помилка");
      }
    },
    [dealId],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (activeId) void loadDetail(activeId);
  }, [activeId, loadDetail]);

  const pushHistory = useCallback(() => {
    const cur = snapRef.current;
    if (!cur) return;
    setPast((p) => [...p.slice(-39), deepCloneSnap(cur)]);
    setFuture([]);
  }, []);

  const patchWorkspace = useCallback(
    (
      fn: (s: WorkspaceSnapshot) => WorkspaceSnapshot,
      recordHistory = false,
    ) => {
      setSnap((s) => {
        if (!s) return s;
        if (recordHistory) pushHistory();
        return fn(deepCloneSnap(s));
      });
      setSaveState("dirty");
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length || !snapRef.current) return p;
      const prev = p[p.length - 1]!;
      setFuture((f) => [deepCloneSnap(snapRef.current!), ...f]);
      setSnap(prev);
      setSaveState("dirty");
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length || !snapRef.current) return f;
      const next = f[0]!;
      setPast((p) => [...p, deepCloneSnap(snapRef.current!)]);
      setSnap(next);
      setSaveState("dirty");
      return f.slice(1);
    });
  }, []);

  const persist = useCallback(async () => {
    const cur = snapRef.current;
    if (!cur || !activeId) return;
    setSaveState("saving");
    setError(null);
    try {
      const linePayload = buildLinePayload(cur.lines);
      const r = await fetch(`/api/deals/${dealId}/estimates/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cur.name,
          notes: cur.notes,
          changeSummary: cur.changeSummary,
          discountAmount: cur.discountAmount,
          deliveryCost: cur.deliveryCost,
          installationCost: cur.installationCost,
          settingsJson: cur.settings,
          sections: cur.sections.map((s) => ({
            id: s.id,
            title: s.title,
            sortOrder: s.sortOrder,
            key: s.key,
          })),
          lineItems: linePayload,
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Збереження не вдалося");
      setSaveState("saved");
      void loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
      setSaveState("dirty");
    }
  }, [dealId, activeId, loadList]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist();
    }, 900);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [saveState, persist, snap]);

  const saveNow = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await persist();
  }, [persist]);

  const selectVersion = useCallback(
    async (id: string) => {
      if (id === activeId) return;
      if (saveStateRef.current === "dirty") await persist();
      setActiveId(id);
    },
    [activeId, persist],
  );

  const newVersion = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/deals/${dealId}/estimates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await r.json()) as { estimate?: { id: string }; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      await loadList();
      if (j.estimate?.id) setActiveId(j.estimate.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
    }
  }, [dealId, loadList]);

  const duplicateVersion = useCallback(async () => {
    if (!activeId) return;
    setError(null);
    try {
      const r = await fetch(`/api/deals/${dealId}/estimates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloneFromEstimateId: activeId }),
      });
      const j = (await r.json()) as { estimate?: { id: string }; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      await loadList();
      if (j.estimate?.id) setActiveId(j.estimate.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
    }
  }, [dealId, activeId, loadList]);

  const setActiveVersion = useCallback(async () => {
    if (!activeId) return;
    try {
      const r = await fetch(`/api/deals/${dealId}/estimates/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setActive: true }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      await loadList();
      await loadDetail(activeId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
    }
  }, [dealId, activeId, loadList, loadDetail]);

  const updateLine = useCallback(
    (lineId: string, patch: Partial<LineModel>) => {
      patchWorkspace((ws) => {
        const lines = ws.lines.map((li) => {
          if (li.id !== lineId) return li;
          let next: LineModel = { ...li, ...patch };
          if (patch.metadataJson)
            next.metadataJson = patch.metadataJson as Record<string, unknown>;
          return activeId ? normalizeLineModel(next, activeId) : next;
        });
        return { ...ws, lines };
      }, false);
    },
    [patchWorkspace, activeId],
  );

  const updateLineMeta = useCallback(
    (lineId: string, metaPatch: Partial<EstimateLineWorkspaceMeta>) => {
      patchWorkspace((ws) => ({
        ...ws,
        lines: ws.lines.map((li) => {
          if (li.id !== lineId) return li;
          const merged = mergeWorkspaceMeta(li.metadataJson, metaPatch);
          const next: LineModel = { ...li, metadataJson: merged };
          return activeId ? normalizeLineModel(next, activeId) : next;
        }),
      }), false);
    },
    [patchWorkspace, activeId],
  );

  const addSection = useCallback(() => {
    patchWorkspace((ws) => {
      const id = newId();
      const sortOrder = ws.sections.length
        ? Math.max(...ws.sections.map((s) => s.sortOrder)) + 1
        : 0;
      return {
        ...ws,
        sections: [...ws.sections, { id, title: "Нова секція", sortOrder, key: null }],
      };
    }, true);
  }, [patchWorkspace]);

  const addLine = useCallback(
    (
      sectionId: string | null,
      type: EstimateLineType = "PRODUCT",
      productName = "Нова позиція",
    ) => {
      patchWorkspace((ws) => {
        const sid = sectionId ?? ws.sections[0]?.id ?? null;
        const sortOrder = ws.lines.length;
        const line: LineModel = {
          id: newId(),
          stableLineId: newId(),
          sectionId: sid,
          type,
          category: null,
          code: null,
          productName,
          qty: 1,
          unit: "шт",
          salePrice: 0,
          costPrice: null,
          amountSale: 0,
          amountCost: null,
          supplierRef: null,
          notes: null,
          metadataJson: { calculationMode: "by_qty" },
          sortOrder,
        };
        const withNorm = activeId ? normalizeLineModel(line, activeId) : line;
        return { ...ws, lines: [...ws.lines, withNorm] };
      }, true);
    },
    [patchWorkspace, activeId],
  );

  const duplicateLine = useCallback(
    (lineId: string) => {
      patchWorkspace((ws) => {
        const li = ws.lines.find((l) => l.id === lineId);
        if (!li) return ws;
        const copy: LineModel = {
          ...(JSON.parse(JSON.stringify(li)) as LineModel),
          id: newId(),
          stableLineId: newId(),
          productName: `${li.productName} (копія)`,
        };
        const norm = activeId ? normalizeLineModel(copy, activeId) : copy;
        return { ...ws, lines: [...ws.lines, norm] };
      }, true);
    },
    [patchWorkspace, activeId],
  );

  const deleteLine = useCallback(
    (lineId: string) => {
      patchWorkspace(
        (ws) => ({
          ...ws,
          lines: ws.lines.filter((l) => l.id !== lineId),
        }),
        true,
      );
    },
    [patchWorkspace],
  );

  const updateSection = useCallback(
    (sectionId: string, patch: Partial<SectionModel>) => {
      patchWorkspace(
        (ws) => ({
          ...ws,
          sections: ws.sections.map((s) =>
            s.id === sectionId ? { ...s, ...patch } : s,
          ),
        }),
        false,
      );
    },
    [patchWorkspace],
  );

  const deleteSection = useCallback(
    (sectionId: string) => {
      patchWorkspace(
        (ws) => {
          const remaining = ws.sections.filter((s) => s.id !== sectionId);
          const fallback = remaining[0]?.id ?? null;
          return {
            ...ws,
            sections: remaining,
            lines: ws.lines.map((l) =>
              l.sectionId === sectionId ? { ...l, sectionId: fallback } : l,
            ),
          };
        },
        true,
      );
    },
    [patchWorkspace],
  );

  const patchHeader = useCallback(
    (
      patch: Partial<
        Pick<
          WorkspaceSnapshot,
          | "name"
          | "notes"
          | "discountAmount"
          | "deliveryCost"
          | "installationCost"
          | "changeSummary"
        >
      > & { settings?: Partial<EstimateWorkspaceSettingsV2> },
    ) => {
      patchWorkspace((ws): WorkspaceSnapshot => {
        const { settings: settingsPatch, ...headerRest } = patch;
        return {
          ...ws,
          ...headerRest,
          settings: settingsPatch
            ? { ...ws.settings, ...settingsPatch, v: SETTINGS_JSON_V }
            : ws.settings,
        };
      }, false);
    },
    [patchWorkspace],
  );

  const reorderSection = useCallback(
    (fromIndex: number, toIndex: number) => {
      patchWorkspace(
        (ws) => {
          const arr = [...ws.sections].sort((a, b) => a.sortOrder - b.sortOrder);
          const [moved] = arr.splice(fromIndex, 1);
          if (!moved) return ws;
          arr.splice(toIndex, 0, moved);
          const next = arr.map((s, i) => ({ ...s, sortOrder: i }));
          return { ...ws, sections: next };
        },
        true,
      );
    },
    [patchWorkspace],
  );

  const domainItems = useMemo((): EstimateItem[] => {
    if (!snap || !activeId) return [];
    return snap.lines.map((l) => lineModelToEstimateItem(l, activeId));
  }, [snap, activeId]);

  const estimateSummary = useMemo((): EstimateSummary | null => {
    if (!snap || !activeId) return null;
    const extra = snap.settings.extraMarginPct ?? 0;
    const lineSaleScale = extra !== 0 ? 1 + extra / 100 : 1;
    return calculateEstimateSummary({
      sections: snap.sections.map((s) => ({
        id: s.id,
        estimateVersionId: activeId,
        name: s.title,
        type:
          snap.settings.sectionUi?.[s.id]?.type ??
          sectionKeyToType(s.key),
        position: s.sortOrder,
        note: snap.settings.sectionNotes?.[s.id] ?? null,
        isCollapsed: snap.settings.sectionUi?.[s.id]?.isCollapsed ?? false,
        subtotalCost: 0,
        subtotalSale: 0,
        subtotalDiscount: 0,
        subtotalMargin: 0,
      })),
      items: domainItems,
      globalDiscountAmount: snap.discountAmount,
      deliveryCost: snap.deliveryCost,
      installationCost: snap.installationCost,
      lineSaleScale,
    });
  }, [snap, activeId, domainItems]);

  const warnings = useMemo((): EstimateWarning[] => {
    if (!snap || !activeId) return [];
    return calculateWarnings({
      estimateId: activeId,
      sectionsEmpty: snap.sections.length === 0,
      itemsEmpty: snap.lines.length === 0,
      hasActiveVersion: list.some((x) => x.isActive),
      items: domainItems,
      globalMarginPct: estimateSummary?.profitabilityPercent ?? null,
    });
  }, [snap, activeId, list, domainItems, estimateSummary]);

  const buildQuotePayload = useCallback(
    (opts: {
      sectionIds?: string[];
      includeBreakdown: boolean;
      includeDelivery: boolean;
      includeInstallation: boolean;
    }) => {
      if (!snap || !activeId || !estimateSummary) return null;
      const row = list.find((x) => x.id === activeId);
      const quoteLines = snap.lines.filter((line) => {
        const meta = parseWorkspaceMeta(line.metadataJson);
        return meta.clientVisible !== false;
      });
      return mapEstimateToQuotePayload({
        estimateId: activeId,
        versionNumber: row?.version ?? 1,
        versionName: snap.name,
        currency: "UAH",
        sections: snap.sections,
        lines: quoteLines,
        globalDiscountAmount: snap.discountAmount,
        deliveryCost: snap.deliveryCost,
        installationCost: snap.installationCost,
        notes: snap.notes,
        sectionIds: opts.sectionIds,
        includeBreakdown: opts.includeBreakdown,
        includeDelivery: opts.includeDelivery,
        includeInstallation: opts.includeInstallation,
      });
    },
    [snap, activeId, estimateSummary, list],
  );

  const totals = useMemo(() => {
    if (!estimateSummary || !snap) {
      return {
        sectionCount: 0,
        itemCount: 0,
        sumSale: 0,
        sumCost: 0,
        margin: 0,
        discount: 0,
        delivery: 0,
        install: 0,
        grand: 0,
      };
    }
    return {
      sectionCount: estimateSummary.sectionCount,
      itemCount: estimateSummary.itemCount,
      sumSale: estimateSummary.totalSale,
      sumCost: estimateSummary.totalCost,
      margin: estimateSummary.totalMargin,
      discount: snap.discountAmount,
      delivery: snap.deliveryCost,
      install: snap.installationCost,
      grand: estimateSummary.grandTotal,
    };
  }, [estimateSummary, snap]);

  return {
    list,
    activeId,
    selectVersion,
    loading,
    error,
    saveState,
    snap,
    patchWorkspace,
    updateLine,
    updateLineMeta,
    addSection,
    addLine,
    duplicateLine,
    deleteLine,
    updateSection,
    deleteSection,
    reorderSection,
    patchHeader,
    loadList,
    loadDetail,
    newVersion,
    duplicateVersion,
    setActiveVersion,
    saveNow,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    totals,
    estimateSummary,
    domainItems,
    warnings,
    buildQuotePayload,
    persist,
  };
}

function deepCloneSnap(s: WorkspaceSnapshot): WorkspaceSnapshot {
  return JSON.parse(JSON.stringify(s)) as WorkspaceSnapshot;
}

function buildLinePayload(lines: LineModel[]) {
  const sorted = [...lines].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.map((li, idx) => ({
    id: li.id,
    stableLineId: li.stableLineId,
    sectionId: li.sectionId,
    type: li.type,
    category: li.category,
    code: li.code,
    productName: li.productName,
    qty: li.qty,
    unit: li.unit,
    salePrice: li.salePrice,
    costPrice: li.costPrice,
    amountSale: li.amountSale,
    amountCost: li.amountCost,
    margin:
      li.amountCost == null ? null : li.amountSale - (li.amountCost ?? 0),
    supplierRef: li.supplierRef,
    notes: li.notes,
    metadataJson:
      Object.keys(li.metadataJson).length > 0 ? li.metadataJson : undefined,
    sortOrder: idx,
  }));
}

