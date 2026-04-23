"use client";

/**
 * Демо: повний однофайловий Lead Estimate (mock repo).
 * Не підключено до маршрутів — для копіювання/порівняння з LeadEstimateComposerClient.
 */

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Copy,
  FileText,
  GripVertical,
  History,
  Layers3,
  PackageSearch,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type VersionStatus = "draft" | "current" | "archived";
type UnitPriceSource = "manual" | "supplier_snapshot";
type PageMode = "empty" | "view" | "draft" | "compare";

type Lead = {
  id: string;
  title: string;
  customerName: string;
  phone: string;
  stage: string;
};

type SupplierPriceSnapshot = {
  supplier: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  price: number;
  currency: string;
  capturedAt: string;
};

type MaterialSearchResult = {
  supplier: string;
  materialId: string;
  code: string;
  name: string;
  price: number;
  currency: string;
  attrs?: string[];
};

type VersionItem = {
  id: string;
  sortOrder: number;
  category: string | null;
  title: string;
  qty: number;
  coefficient: number;
  unitPrice: number;
  totalPrice: number;
  supplier: string | null;
  supplierMaterialId: string | null;
  supplierMaterialCode: string | null;
  supplierMaterialName: string | null;
  supplierPriceSnapshot: SupplierPriceSnapshot | null;
  unitPriceSource: UnitPriceSource;
  note?: string | null;
};

type EstimateVersion = {
  id: string;
  estimateId: string;
  versionNumber: number;
  status: VersionStatus;
  baseVersionId?: string | null;
  changeNote?: string | null;
  currency: string;
  createdAt: string;
  createdBy: string;
  items: VersionItem[];
  subtotal: number;
  total: number;
};

type Estimate = {
  id: string;
  leadId: string;
  name: string;
  currency: string;
  currentVersionId: string | null;
};

type EstimateWorkspace = {
  lead: Lead;
  estimate: Estimate | null;
  currentVersion: EstimateVersion | null;
  versionHistory: EstimateVersion[];
};

type DraftItem = {
  tempId: string;
  baseItemId?: string;
  sortOrder: number;
  category: string | null;
  title: string;
  qty: number;
  coefficient: number;
  unitPrice: number;
  totalPrice: number;
  supplier: string | null;
  supplierMaterialId: string | null;
  supplierMaterialCode: string | null;
  supplierMaterialName: string | null;
  supplierPriceSnapshot: SupplierPriceSnapshot | null;
  unitPriceSource: UnitPriceSource;
  note?: string | null;
};

type DraftState = {
  estimateId: string | null;
  baseVersionId: string | null;
  name: string;
  currency: string;
  changeNote: string;
  items: DraftItem[];
};

type ChangedField = {
  field: string;
  from: string | number | null;
  to: string | number | null;
};

type ChangedItem = {
  baseItemId: string;
  title: string;
  fields: ChangedField[];
  beforeTotal: number;
  afterTotal: number;
};

type DiffResult = {
  added: DraftItem[];
  removed: VersionItem[];
  changed: ChangedItem[];
  totalDelta: number;
};

type PublishVersionInput = {
  estimateId: string;
  baseVersionId: string | null;
  name: string;
  currency: string;
  changeNote?: string;
  items: DraftItem[];
};

// ============================================================================
// UTILS
// ============================================================================

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function calcLineTotal(qty: number, coefficient: number, unitPrice: number) {
  return roundMoney(
    (Number(qty) || 0) * (Number(coefficient) || 0) * (Number(unitPrice) || 0),
  );
}

function recalcVersionTotals(items: Array<{ totalPrice: number }>) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.totalPrice, 0));
  return { subtotal, total: subtotal };
}

function formatMoney(value: number, currency = "UAH") {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function snapshotFromMaterial(material: MaterialSearchResult): SupplierPriceSnapshot {
  return {
    supplier: material.supplier,
    materialId: material.materialId,
    materialCode: material.code,
    materialName: material.name,
    price: material.price,
    currency: material.currency,
    capturedAt: new Date().toISOString(),
  };
}

function toDraftItem(item: VersionItem): DraftItem {
  return {
    tempId: uid("draft"),
    baseItemId: item.id,
    sortOrder: item.sortOrder,
    category: item.category,
    title: item.title,
    qty: item.qty,
    coefficient: item.coefficient,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    supplier: item.supplier,
    supplierMaterialId: item.supplierMaterialId,
    supplierMaterialCode: item.supplierMaterialCode,
    supplierMaterialName: item.supplierMaterialName,
    supplierPriceSnapshot: item.supplierPriceSnapshot,
    unitPriceSource: item.unitPriceSource,
    note: item.note ?? "",
  };
}

function makeEmptyDraftItem(order: number): DraftItem {
  return {
    tempId: uid("temp"),
    sortOrder: order,
    category: null,
    title: "",
    qty: 1,
    coefficient: 1,
    unitPrice: 0,
    totalPrice: 0,
    supplier: null,
    supplierMaterialId: null,
    supplierMaterialCode: null,
    supplierMaterialName: null,
    supplierPriceSnapshot: null,
    unitPriceSource: "manual",
    note: "",
  };
}

function recalcDraftItem(item: DraftItem): DraftItem {
  return {
    ...item,
    totalPrice: calcLineTotal(item.qty, item.coefficient, item.unitPrice),
  };
}

function normalizeDraftItems(items: DraftItem[]) {
  return items.map((item, index) =>
    recalcDraftItem({ ...item, sortOrder: index + 1 }),
  );
}

function computeItemChanges(base: VersionItem, draft: DraftItem): ChangedField[] {
  const fields: ChangedField[] = [];
  const check = (
    field: string,
    from: string | number | null,
    to: string | number | null,
  ) => {
    if (from !== to) fields.push({ field, from, to });
  };
  check("category", base.category, draft.category);
  check("title", base.title, draft.title);
  check("qty", base.qty, draft.qty);
  check("coefficient", base.coefficient, draft.coefficient);
  check("unitPrice", base.unitPrice, draft.unitPrice);
  check("supplier", base.supplier, draft.supplier);
  check("materialCode", base.supplierMaterialCode, draft.supplierMaterialCode);
  check("note", base.note ?? null, draft.note ?? null);
  return fields;
}

function computeDiff(baseVersion: EstimateVersion, draftItems: DraftItem[]): DiffResult {
  const baseById = new Map(baseVersion.items.map((item) => [item.id, item]));
  const draftByBaseId = new Map(
    draftItems
      .filter((i) => i.baseItemId)
      .map((item) => [item.baseItemId as string, item]),
  );

  const added = draftItems.filter((item) => !item.baseItemId);
  const removed = baseVersion.items.filter((item) => !draftByBaseId.has(item.id));
  const changed: ChangedItem[] = [];

  for (const draft of draftItems) {
    if (!draft.baseItemId) continue;
    const base = baseById.get(draft.baseItemId);
    if (!base) continue;
    const fields = computeItemChanges(base, draft);
    if (fields.length > 0) {
      changed.push({
        baseItemId: base.id,
        title: draft.title || base.title,
        fields,
        beforeTotal: base.totalPrice,
        afterTotal: draft.totalPrice,
      });
    }
  }

  const draftTotal = recalcVersionTotals(draftItems).total;
  return {
    added,
    removed,
    changed,
    totalDelta: roundMoney(draftTotal - baseVersion.total),
  };
}

function getDraftMarker(
  item: DraftItem,
  diff: DiffResult | null,
): "added" | "changed" | null {
  if (!diff) return null;
  if (!item.baseItemId) return "added";
  if (diff.changed.some((entry) => entry.baseItemId === item.baseItemId))
    return "changed";
  return null;
}

// ============================================================================
// FAKE DATABASE
// ============================================================================

const MATERIALS_DB: MaterialSearchResult[] = [
  {
    supplier: "Viyar",
    materialId: "viyar-egger-w980-18",
    code: "EG-W980-18",
    name: "ДСП Egger W980 18mm",
    price: 1480,
    currency: "UAH",
    attrs: ["Egger", "18mm", "Білий"],
  },
  {
    supplier: "Viyar",
    materialId: "viyar-egger-u999-18",
    code: "EG-U999-18",
    name: "ДСП Egger U999 18mm",
    price: 1625,
    currency: "UAH",
    attrs: ["Egger", "18mm", "Чорний"],
  },
  {
    supplier: "Viyar",
    materialId: "viyar-mdf-silk-19",
    code: "MDF-SILK-19",
    name: "MDF Silk White 19mm",
    price: 1950,
    currency: "UAH",
    attrs: ["MDF", "19mm", "Фасад"],
  },
  {
    supplier: "Viyar",
    materialId: "viyar-blum-legrabox",
    code: "BLUM-LEG-500",
    name: "Blum Legrabox 500",
    price: 2280,
    currency: "UAH",
    attrs: ["Blum", "Шухляда"],
  },
  {
    supplier: "Hettich",
    materialId: "hettich-avantech",
    code: "HET-AVT-500",
    name: "Hettich AvanTech 500",
    price: 2140,
    currency: "UAH",
    attrs: ["Hettich", "Шухляда"],
  },
  {
    supplier: "Viyar",
    materialId: "viyar-delivery",
    code: "SERVICE-DELIVERY",
    name: "Доставка меблів",
    price: 2500,
    currency: "UAH",
    attrs: ["Service"],
  },
];

const LEAD_DB: Lead = {
  id: "lead_001",
  title: "Кухня Петренко — вул. Драгомирова",
  customerName: "Олександр Петренко",
  phone: "+380 67 123 45 67",
  stage: "Прорахунок",
};

function makeVersion(
  versionNumber: number,
  status: VersionStatus,
  items: VersionItem[],
  createdBy: string,
  createdAt: string,
  estimateId: string,
  baseVersionId?: string | null,
  changeNote?: string | null,
): EstimateVersion {
  const totals = recalcVersionTotals(items);
  return {
    id: uid(`ver_${versionNumber}`),
    estimateId,
    versionNumber,
    status,
    baseVersionId: baseVersionId ?? null,
    changeNote: changeNote ?? null,
    currency: "UAH",
    createdAt,
    createdBy,
    items,
    subtotal: totals.subtotal,
    total: totals.total,
  };
}

const estimateIdSeed = "estimate_001";

const seedV4 = makeVersion(
  4,
  "archived",
  [
    {
      id: "v4_i1",
      sortOrder: 1,
      category: "Корпус",
      title: "Корпус верхніх секцій",
      qty: 3,
      coefficient: 1,
      unitPrice: 1480,
      totalPrice: calcLineTotal(3, 1, 1480),
      supplier: "Viyar",
      supplierMaterialId: "viyar-egger-w980-18",
      supplierMaterialCode: "EG-W980-18",
      supplierMaterialName: "ДСП Egger W980 18mm",
      supplierPriceSnapshot: snapshotFromMaterial(MATERIALS_DB[0]),
      unitPriceSource: "supplier_snapshot",
      note: null,
    },
    {
      id: "v4_i2",
      sortOrder: 2,
      category: "Фурнітура",
      title: "Шухляди Blum Legrabox",
      qty: 2,
      coefficient: 1,
      unitPrice: 2280,
      totalPrice: calcLineTotal(2, 1, 2280),
      supplier: "Viyar",
      supplierMaterialId: "viyar-blum-legrabox",
      supplierMaterialCode: "BLUM-LEG-500",
      supplierMaterialName: "Blum Legrabox 500",
      supplierPriceSnapshot: snapshotFromMaterial(MATERIALS_DB[3]),
      unitPriceSource: "supplier_snapshot",
      note: null,
    },
  ],
  "Анна",
  "2026-03-18T10:00:00.000Z",
  estimateIdSeed,
  null,
  "Початковий погоджений прорахунок",
);

const seedV5 = makeVersion(
  5,
  "current",
  [
    {
      id: "v5_i1",
      sortOrder: 1,
      category: "Корпус",
      title: "Корпус верхніх секцій",
      qty: 4,
      coefficient: 1,
      unitPrice: 1480,
      totalPrice: calcLineTotal(4, 1, 1480),
      supplier: "Viyar",
      supplierMaterialId: "viyar-egger-w980-18",
      supplierMaterialCode: "EG-W980-18",
      supplierMaterialName: "ДСП Egger W980 18mm",
      supplierPriceSnapshot: snapshotFromMaterial(MATERIALS_DB[0]),
      unitPriceSource: "supplier_snapshot",
      note: null,
    },
    {
      id: "v5_i2",
      sortOrder: 2,
      category: "Фасад",
      title: "Фасади MDF Silk White",
      qty: 3,
      coefficient: 1.1,
      unitPrice: 1950,
      totalPrice: calcLineTotal(3, 1.1, 1950),
      supplier: "Viyar",
      supplierMaterialId: "viyar-mdf-silk-19",
      supplierMaterialCode: "MDF-SILK-19",
      supplierMaterialName: "MDF Silk White 19mm",
      supplierPriceSnapshot: snapshotFromMaterial(MATERIALS_DB[2]),
      unitPriceSource: "supplier_snapshot",
      note: "Матовий фасад",
    },
    {
      id: "v5_i3",
      sortOrder: 3,
      category: "Фурнітура",
      title: "Шухляди Blum Legrabox",
      qty: 2,
      coefficient: 1,
      unitPrice: 2280,
      totalPrice: calcLineTotal(2, 1, 2280),
      supplier: "Viyar",
      supplierMaterialId: "viyar-blum-legrabox",
      supplierMaterialCode: "BLUM-LEG-500",
      supplierMaterialName: "Blum Legrabox 500",
      supplierPriceSnapshot: snapshotFromMaterial(MATERIALS_DB[3]),
      unitPriceSource: "supplier_snapshot",
      note: null,
    },
  ],
  "Анна",
  "2026-03-22T14:10:00.000Z",
  estimateIdSeed,
  seedV4.id,
  "Оновлено склад фасадів",
);

class FakeEstimateRepo {
  private workspace: EstimateWorkspace;

  constructor() {
    this.workspace = {
      lead: LEAD_DB,
      estimate: {
        id: estimateIdSeed,
        leadId: LEAD_DB.id,
        name: "Кухня / Петренко / основний прорахунок",
        currency: "UAH",
        currentVersionId: seedV5.id,
      },
      currentVersion: seedV5,
      versionHistory: [seedV5, seedV4],
    };
  }

  async getWorkspace(): Promise<EstimateWorkspace> {
    await sleep(150);
    return deepClone(this.workspace);
  }

  async searchMaterials(query: string): Promise<MaterialSearchResult[]> {
    await sleep(120);
    const q = query.trim().toLowerCase();
    if (!q) return MATERIALS_DB.slice(0, 6);
    return MATERIALS_DB.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.supplier.toLowerCase().includes(q),
    ).slice(0, 8);
  }

  async createFirstEstimate(input: {
    name: string;
    currency: string;
    items: DraftItem[];
    changeNote?: string;
  }): Promise<EstimateWorkspace> {
    await sleep(200);
    const estimateId = uid("estimate");
    const items = input.items.map((item, index) =>
      this.toVersionItem(item, 1, index),
    );
    const version1 = makeVersion(
      1,
      "current",
      items,
      "Ви",
      new Date().toISOString(),
      estimateId,
      null,
      input.changeNote ?? null,
    );

    this.workspace = {
      lead: this.workspace.lead,
      estimate: {
        id: estimateId,
        leadId: this.workspace.lead.id,
        name: input.name,
        currency: input.currency,
        currentVersionId: version1.id,
      },
      currentVersion: version1,
      versionHistory: [version1],
    };

    return deepClone(this.workspace);
  }

  async publishNewVersion(input: PublishVersionInput): Promise<EstimateWorkspace> {
    await sleep(250);

    if (!this.workspace.estimate) throw new Error("Estimate not found");
    const current = this.workspace.currentVersion;
    if (!current) throw new Error("Current version missing");

    const nextVersionNumber =
      Math.max(...this.workspace.versionHistory.map((v) => v.versionNumber)) + 1;

    const publishedItems = input.items.map((item, index) =>
      this.toVersionItem(item, nextVersionNumber, index),
    );

    const newCurrent = makeVersion(
      nextVersionNumber,
      "current",
      publishedItems,
      "Ви",
      new Date().toISOString(),
      input.estimateId,
      input.baseVersionId,
      input.changeNote ?? null,
    );

    const archivedHistory = this.workspace.versionHistory.map((version) =>
      version.status === "current"
        ? { ...version, status: "archived" as const }
        : version,
    );

    this.workspace = {
      ...this.workspace,
      estimate: {
        ...this.workspace.estimate,
        id: input.estimateId,
        name: input.name,
        currency: input.currency,
        currentVersionId: newCurrent.id,
      },
      currentVersion: newCurrent,
      versionHistory: [newCurrent, ...archivedHistory],
    };

    return deepClone(this.workspace);
  }

  private toVersionItem(
    item: DraftItem,
    versionNumber: number,
    index: number,
  ): VersionItem {
    const lineTotal = calcLineTotal(item.qty, item.coefficient, item.unitPrice);
    return {
      id: `v${versionNumber}_i${index + 1}_${Math.random().toString(36).slice(2, 6)}`,
      sortOrder: index + 1,
      category: item.category,
      title: item.title.trim() || "Без назви",
      qty: Number(item.qty) || 0,
      coefficient: Number(item.coefficient) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      totalPrice: lineTotal,
      supplier: item.supplier,
      supplierMaterialId: item.supplierMaterialId,
      supplierMaterialCode: item.supplierMaterialCode,
      supplierMaterialName: item.supplierMaterialName,
      supplierPriceSnapshot: item.supplierPriceSnapshot,
      unitPriceSource: item.unitPriceSource,
      note: item.note ?? null,
    };
  }
}

const repo = new FakeEstimateRepo();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ============================================================================
// PAGE
// ============================================================================

export default function LeadEstimatePageSingleFileFull() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageMode, setPageMode] = useState<PageMode>("view");
  const [workspace, setWorkspace] = useState<EstimateWorkspace | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [compareFromId, setCompareFromId] = useState<string | null>(null);
  const [compareToId, setCompareToId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [searchState, setSearchState] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<
    Record<string, MaterialSearchResult[]>
  >({});
  const [searchLoading, setSearchLoading] = useState<Record<string, boolean>>({});
  const searchTimers = useRef<Record<string, number | undefined>>({});

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true);
      const data = await repo.getWorkspace();
      if (!mounted) return;
      setWorkspace(data);
      setSelectedVersionId(data.currentVersion?.id ?? null);
      setCompareFromId(
        data.versionHistory[1]?.id ?? data.currentVersion?.id ?? null,
      );
      setCompareToId(data.currentVersion?.id ?? null);
      setPageMode(data.currentVersion ? "view" : "empty");
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const currentVersion = workspace?.currentVersion ?? null;
  const versionHistory = workspace?.versionHistory ?? [];
  const selectedVersion =
    versionHistory.find((v) => v.id === selectedVersionId) ?? currentVersion;
  const compareFrom =
    versionHistory.find((v) => v.id === compareFromId) ??
    versionHistory[0] ??
    null;
  const compareTo =
    versionHistory.find((v) => v.id === compareToId) ?? currentVersion;

  const draftTotals = useMemo(() => {
    if (!draft) return { subtotal: 0, total: 0 };
    return recalcVersionTotals(draft.items);
  }, [draft]);

  const liveDiff = useMemo(() => {
    if (!draft || !currentVersion) return null;
    return computeDiff(currentVersion, draft.items);
  }, [draft, currentVersion]);

  const compareDiff = useMemo(() => {
    if (!compareFrom || !compareTo) return null;
    return computeDiff(compareFrom, compareTo.items.map(toDraftItem));
  }, [compareFrom, compareTo]);

  const publishDisabled = useMemo(() => {
    if (!draft || saving) return true;
    const hasValidItems =
      draft.items.length > 0 && draft.items.some((i) => i.title.trim().length > 0);
    const hasValidNumbers = draft.items.every(
      (i) => i.qty > 0 && i.coefficient > 0 && i.unitPrice >= 0,
    );
    if (!hasValidItems || !hasValidNumbers) return true;
    if (!currentVersion) return false;
    if (!liveDiff) return true;
    const hasActualChanges = !!(
      liveDiff.added.length ||
      liveDiff.removed.length ||
      liveDiff.changed.length
    );
    return !hasActualChanges;
  }, [draft, currentVersion, liveDiff, saving]);

  async function startFirstEstimate() {
    setPageMode("draft");
    setDraft({
      estimateId: null,
      baseVersionId: null,
      name: "Новий розрахунок",
      currency: "UAH",
      changeNote: "",
      items: [makeEmptyDraftItem(1)],
    });
  }

  async function startNewVersionFromCurrent() {
    if (!workspace?.estimate || !currentVersion) return;
    setPageMode("draft");
    setDraft({
      estimateId: workspace.estimate.id,
      baseVersionId: currentVersion.id,
      name: workspace.estimate.name,
      currency: workspace.estimate.currency,
      changeNote: "",
      items: currentVersion.items.map(toDraftItem),
    });
  }

  async function useVersionAsBase(versionId: string) {
    const version = versionHistory.find((v) => v.id === versionId);
    if (!workspace?.estimate || !version) return;
    setPageMode("draft");
    setSelectedVersionId(version.id);
    setDraft({
      estimateId: workspace.estimate.id,
      baseVersionId: version.id,
      name: workspace.estimate.name,
      currency: workspace.estimate.currency,
      changeNote: `Нова версія на базі v${version.versionNumber}`,
      items: version.items.map(toDraftItem),
    });
  }

  function discardDraft() {
    setDraft(null);
    setSearchState({});
    setSearchResults({});
    setSearchLoading({});
    setPageMode(currentVersion ? "view" : "empty");
  }

  async function publishDraft() {
    if (!draft) return;
    setSaving(true);
    try {
      let nextWorkspace: EstimateWorkspace;

      if (!workspace?.estimate) {
        nextWorkspace = await repo.createFirstEstimate({
          name: draft.name,
          currency: draft.currency,
          changeNote: draft.changeNote,
          items: normalizeDraftItems(draft.items),
        });
      } else {
        nextWorkspace = await repo.publishNewVersion({
          estimateId: draft.estimateId || workspace.estimate.id,
          baseVersionId: draft.baseVersionId,
          name: draft.name,
          currency: draft.currency,
          changeNote: draft.changeNote,
          items: normalizeDraftItems(draft.items),
        });
      }

      setWorkspace(nextWorkspace);
      setSelectedVersionId(nextWorkspace.currentVersion?.id ?? null);
      setCompareFromId(
        nextWorkspace.versionHistory[1]?.id ??
          nextWorkspace.currentVersion?.id ??
          null,
      );
      setCompareToId(nextWorkspace.currentVersion?.id ?? null);
      setDraft(null);
      setSearchState({});
      setSearchResults({});
      setPageMode("view");
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(patch: Partial<DraftState>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function updateDraftItem(tempId: string, patch: Partial<DraftItem>) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.tempId === tempId ? recalcDraftItem({ ...item, ...patch }) : item,
        ),
      };
    });
  }

  function addDraftItem(preset?: Partial<DraftItem>) {
    setDraft((prev) => {
      const base = prev ?? {
        estimateId: workspace?.estimate?.id ?? null,
        baseVersionId: currentVersion?.id ?? null,
        name: workspace?.estimate?.name ?? "Новий розрахунок",
        currency: workspace?.estimate?.currency ?? "UAH",
        changeNote: "",
        items: [],
      };

      const item = recalcDraftItem({
        ...makeEmptyDraftItem(base.items.length + 1),
        ...preset,
      });

      return {
        ...base,
        items: normalizeDraftItems([...base.items, item]),
      };
    });
  }

  function duplicateDraftItem(tempId: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const source = prev.items.find((i) => i.tempId === tempId);
      if (!source) return prev;
      const clone = recalcDraftItem({
        ...source,
        tempId: uid("temp"),
        baseItemId: undefined,
      });
      return {
        ...prev,
        items: normalizeDraftItems([...prev.items, clone]),
      };
    });
  }

  function removeDraftItem(tempId: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: normalizeDraftItems(prev.items.filter((i) => i.tempId !== tempId)),
      };
    });
  }

  function resetSupplierPrice(tempId: string) {
    const item = draft?.items.find((i) => i.tempId === tempId);
    if (!item?.supplierPriceSnapshot) return;
    updateDraftItem(tempId, {
      unitPrice: item.supplierPriceSnapshot.price,
      unitPriceSource: "supplier_snapshot",
    });
  }

  function applyMaterial(tempId: string, material: MaterialSearchResult) {
    const existing = draft?.items.find((item) => item.tempId === tempId);
    updateDraftItem(tempId, {
      title: existing?.title?.trim() ? existing.title : material.name,
      supplier: material.supplier,
      supplierMaterialId: material.materialId,
      supplierMaterialCode: material.code,
      supplierMaterialName: material.name,
      supplierPriceSnapshot: snapshotFromMaterial(material),
      unitPrice: material.price,
      unitPriceSource: "supplier_snapshot",
    });
  }

  function handleSearch(itemId: string, value: string) {
    setSearchState((prev) => ({ ...prev, [itemId]: value }));
    setSearchLoading((prev) => ({ ...prev, [itemId]: true }));

    if (searchTimers.current[itemId]) {
      window.clearTimeout(searchTimers.current[itemId]);
    }

    searchTimers.current[itemId] = window.setTimeout(() => {
      void (async () => {
        const results = await repo.searchMaterials(value);
        setSearchResults((prev) => ({ ...prev, [itemId]: results }));
        setSearchLoading((prev) => ({ ...prev, [itemId]: false }));
      })();
    }, 250);
  }

  function openCompare(versionId: string) {
    if (!currentVersion) return;
    setCompareFromId(versionId);
    setCompareToId(currentVersion.id);
    setPageMode("compare");
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (!workspace) {
    return (
      <ErrorScreen message="Не вдалося завантажити workspace estimate." />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-[1600px] px-6 py-6 lg:px-8">
        <PageHeader
          lead={workspace.lead}
          currentVersion={currentVersion}
          selectedVersion={selectedVersion}
          mode={pageMode}
          onBackToView={() => {
            setPageMode(currentVersion ? "view" : "empty");
            setSelectedVersionId(currentVersion?.id ?? null);
          }}
          onNewVersion={startNewVersionFromCurrent}
          onCreateProposal={() =>
            alert(
              `Створити proposal from ${currentVersion ? `v${currentVersion.versionNumber}` : "v1"}`,
            )
          }
        />

        {pageMode === "draft" && draft && (
          <DraftBanner
            baseVersion={
              draft.baseVersionId && currentVersion
                ? `v${currentVersion.versionNumber}`
                : "без збереженої версії"
            }
            nextVersion={
              workspace.estimate
                ? `v${(currentVersion?.versionNumber || 0) + 1}`
                : "v1"
            }
            onDiscard={discardDraft}
            onPreview={() =>
              document
                .getElementById("diff-preview")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            onPublish={publishDraft}
            disabled={publishDisabled}
            saving={saving}
          />
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-6">
            {pageMode === "empty" && (
              <EmptyEstimateState onCreate={startFirstEstimate} />
            )}

            {pageMode !== "empty" && (
              <MetaStrip
                estimateName={draft ? draft.name : workspace.estimate?.name ?? "Estimate"}
                setEstimateName={(value) => {
                  if (draft) updateDraft({ name: value });
                }}
                mode={pageMode}
                currency={
                  draft ? draft.currency : workspace.estimate?.currency ?? "UAH"
                }
                basedOn={
                  draft?.baseVersionId && currentVersion
                    ? `v${currentVersion.versionNumber}`
                    : undefined
                }
                changeNote={
                  draft?.changeNote ?? selectedVersion?.changeNote ?? ""
                }
                setChangeNote={(value) => {
                  if (draft) updateDraft({ changeNote: value });
                }}
              />
            )}

            {pageMode === "view" && selectedVersion && (
              <section className="rounded-3xl border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
                <SectionTitle
                  icon={<ClipboardList className="h-4 w-4" />}
                  title={`Позиції версії v${selectedVersion.versionNumber}`}
                  description="Поточна або архівна версія відкривається в лише для перегляду. Для змін завжди створюється нова версія."
                />
                <div className="mt-5 space-y-4">
                  {selectedVersion.items.map((item) => (
                    <ReadonlyItemCard
                      key={item.id}
                      item={item}
                      currency={selectedVersion.currency}
                    />
                  ))}
                </div>
                <TotalsBlock
                  total={selectedVersion.total}
                  subtotal={selectedVersion.subtotal}
                  itemsCount={selectedVersion.items.length}
                  manualAdjustments={
                    selectedVersion.items.filter((i) => i.unitPriceSource === "manual")
                      .length
                  }
                  delta={
                    currentVersion && selectedVersion.id !== currentVersion.id
                      ? selectedVersion.total - currentVersion.total
                      : 0
                  }
                  currency={selectedVersion.currency}
                />
              </section>
            )}

            {pageMode === "draft" && draft && (
              <section className="rounded-3xl border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
                <SectionTitle
                  icon={<Wand2 className="h-4 w-4" />}
                  title={workspace.estimate ? "Нова версія estimate" : "Перший estimate"}
                  description={
                    workspace.estimate
                      ? "Редагується тільки чернетка. Після публікації система створить нову незмінну версію."
                      : "Швидко створіть перший комерційний розрахунок."
                  }
                  action={
                    <div className="flex flex-wrap gap-2">
                      <QuickAddButton
                        label="Фасад"
                        onClick={() => addDraftItem({ category: "Фасад" })}
                      />
                      <QuickAddButton
                        label="Корпус"
                        onClick={() => addDraftItem({ category: "Корпус" })}
                      />
                      <QuickAddButton
                        label="Фурнітура"
                        onClick={() => addDraftItem({ category: "Фурнітура" })}
                      />
                      <QuickAddButton
                        label="Монтаж"
                        onClick={() => addDraftItem({ category: "Монтаж" })}
                      />
                      <QuickAddButton
                        label="Доставка"
                        onClick={() => addDraftItem({ category: "Доставка" })}
                      />
                    </div>
                  }
                />

                <div className="mt-5 space-y-4">
                  {draft.items.map((item) => (
                    <EditableItemCard
                      key={item.tempId}
                      item={item}
                      marker={getDraftMarker(item, liveDiff)}
                      searchQuery={searchState[item.tempId] ?? ""}
                      searchResults={
                        searchResults[item.tempId] ?? MATERIALS_DB.slice(0, 5)
                      }
                      searchLoading={!!searchLoading[item.tempId]}
                      onSearchQueryChange={(value) =>
                        handleSearch(item.tempId, value)
                      }
                      onChange={(patch) => {
                        const nextPatch =
                          patch.unitPrice !== undefined
                            ? { ...patch, unitPriceSource: "manual" as const }
                            : patch;
                        updateDraftItem(item.tempId, nextPatch);
                      }}
                      onSelectMaterial={(material) =>
                        applyMaterial(item.tempId, material)
                      }
                      onDuplicate={() => duplicateDraftItem(item.tempId)}
                      onRemove={() => removeDraftItem(item.tempId)}
                      onResetSupplierPrice={() => resetSupplierPrice(item.tempId)}
                    />
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => addDraftItem()}
                    className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
                  >
                    <Plus className="h-4 w-4" />
                    Додати позицію
                  </button>
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2 text-xs text-zinc-600">
                    <Sparkles className="h-4 w-4" />
                    Швидкий флоу: title → material → qty/coefficient → готово
                  </div>
                </div>

                <TotalsBlock
                  total={draftTotals.total}
                  subtotal={draftTotals.subtotal}
                  itemsCount={draft.items.length}
                  manualAdjustments={
                    draft.items.filter((i) => i.unitPriceSource === "manual").length
                  }
                  delta={
                    currentVersion
                      ? draftTotals.total - currentVersion.total
                      : draftTotals.total
                  }
                  currency={draft.currency}
                />
              </section>
            )}

            {pageMode === "compare" && compareDiff && compareFrom && compareTo && (
              <section className="rounded-3xl border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
                <SectionTitle
                  icon={<Layers3 className="h-4 w-4" />}
                  title={`Порівняння v${compareFrom.versionNumber} → v${compareTo.versionNumber}`}
                  description="Показуємо тільки те, що реально змінилось між версіями."
                />
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <SummaryMiniCard
                    label="Added"
                    value={String(compareDiff.added.length)}
                  />
                  <SummaryMiniCard
                    label="Removed"
                    value={String(compareDiff.removed.length)}
                  />
                  <SummaryMiniCard
                    label="Changed"
                    value={String(compareDiff.changed.length)}
                  />
                  <SummaryMiniCard
                    label="Total delta"
                    value={formatMoney(compareDiff.totalDelta, compareTo.currency)}
                  />
                </div>
                <DiffPreview
                  diff={compareDiff}
                  currency={compareTo.currency}
                  title={`Зміни між v${compareFrom.versionNumber} та v${compareTo.versionNumber}`}
                />
              </section>
            )}

            {pageMode === "draft" && liveDiff && (
              <div id="diff-preview">
                <DiffPreview
                  diff={liveDiff}
                  currency={draft?.currency ?? "UAH"}
                  title={
                    workspace.estimate
                      ? `Попередній перегляд змін перед створенням v${(currentVersion?.versionNumber || 0) + 1}`
                      : "Попередній перегляд першого estimate"
                  }
                />
              </div>
            )}

            {pageMode === "draft" && draft && (
              <BottomActionBar
                nextVersion={
                  workspace.estimate
                    ? `v${(currentVersion?.versionNumber || 0) + 1}`
                    : "v1"
                }
                total={draftTotals.total}
                disabled={publishDisabled}
                saving={saving}
                onDiscard={discardDraft}
                onPublish={publishDraft}
              />
            )}

            <ImplementationAppendix />
          </main>

          <Sidebar
            mode={pageMode}
            currentVersion={currentVersion}
            selectedVersion={selectedVersion}
            compareFrom={compareFrom}
            compareTo={compareTo}
            draftTotal={draftTotals.total}
            draftItemsCount={draft?.items.length ?? 0}
            diff={
              pageMode === "draft"
                ? liveDiff
                : pageMode === "compare"
                  ? compareDiff
                  : null
            }
            versions={versionHistory}
            compareFromId={compareFromId}
            compareToId={compareToId}
            onSelectVersion={(id) => {
              setSelectedVersionId(id);
              setPageMode("view");
            }}
            onUseAsBase={useVersionAsBase}
            onCompare={openCompare}
            onChangeCompareFrom={setCompareFromId}
            onChangeCompareTo={setCompareToId}
            onOpenCompareMode={() => setPageMode("compare")}
            onNewVersion={startNewVersionFromCurrent}
            onCreateFirst={startFirstEstimate}
            hasEstimate={!!workspace.estimate}
            leadId={workspace.lead.id}
            estimateId={workspace.estimate?.id ?? null}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SCREEN STATES
// ============================================================================

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-[1600px] animate-pulse space-y-6">
        <div className="h-28 rounded-[28px] bg-[var(--enver-card)]" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <div className="h-24 rounded-3xl bg-[var(--enver-card)]" />
            <div className="h-[420px] rounded-3xl bg-[var(--enver-card)]" />
            <div className="h-[280px] rounded-3xl bg-[var(--enver-card)]" />
          </div>
          <div className="space-y-4">
            <div className="h-40 rounded-3xl bg-[var(--enver-card)]" />
            <div className="h-72 rounded-3xl bg-[var(--enver-card)]" />
            <div className="h-60 rounded-3xl bg-[var(--enver-card)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-xl rounded-3xl border border-rose-200 bg-[var(--enver-card)] p-8 text-center shadow-sm">
        <div className="text-xl font-semibold text-zinc-950">Помилка</div>
        <div className="mt-3 text-zinc-600">{message}</div>
      </div>
    </div>
  );
}

function EmptyEstimateState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="rounded-[28px] border border-dashed border-zinc-300 bg-[var(--enver-card)] p-10 shadow-sm">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
          <ClipboardList className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950">
          Ще немає розрахунку
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Створіть перший estimate, щоб швидко підготувати комерційну пропозицію. Це швидкий sales composer,
          а не ERP-екран і не таблиця в стилі Excel.
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={onCreate}
            className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Створити перший розрахунок
          </button>
        </div>
      </div>
    </section>
  );
}

function PageHeader({
  lead,
  currentVersion,
  selectedVersion,
  mode,
  onBackToView,
  onNewVersion,
  onCreateProposal,
}: {
  lead: Lead;
  currentVersion: EstimateVersion | null;
  selectedVersion: EstimateVersion | null;
  mode: PageMode;
  onBackToView: () => void;
  onNewVersion: () => void;
  onCreateProposal: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-xl px-2 py-1 hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Lead
            </button>
            <ChevronRight className="h-4 w-4" />
            <span>Estimate</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              {lead.title}
            </h1>
            <StatusChip tone="blue">{lead.stage}</StatusChip>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
            <span>{lead.customerName}</span>
            <span>•</span>
            <span>{lead.phone}</span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 xl:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700">
              Estimate
            </div>
            {selectedVersion ? (
              <StatusChip tone={selectedVersion.status === "current" ? "green" : "zinc"}>
                v{selectedVersion.versionNumber}{" "}
                {selectedVersion.status === "current" ? "Current" : "Archived"}
              </StatusChip>
            ) : (
              <StatusChip tone="zinc">No estimate</StatusChip>
            )}
            {mode !== "view" && mode !== "empty" ? (
              <StatusChip tone="amber">
                {mode === "draft" ? "Draft mode" : "Compare mode"}
              </StatusChip>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {mode !== "view" && mode !== "empty" ? (
              <button
                type="button"
                onClick={onBackToView}
                className="rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
              >
                Повернутись до current
              </button>
            ) : null}
            <button
              type="button"
              onClick={onCreateProposal}
              disabled={!currentVersion}
              className="rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Створити proposal
            </button>
            <button
              type="button"
              onClick={onNewVersion}
              disabled={!currentVersion}
              className="rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              New version
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftBanner({
  baseVersion,
  nextVersion,
  onDiscard,
  onPreview,
  onPublish,
  disabled,
  saving,
}: {
  baseVersion: string;
  nextVersion: string;
  onDiscard: () => void;
  onPreview: () => void;
  onPublish: () => void;
  disabled: boolean;
  saving: boolean;
}) {
  return (
    <div className="mt-5 flex flex-col gap-4 rounded-[28px] border border-amber-200 bg-amber-50 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-sm font-semibold text-amber-900">Нова версія ще не створена</div>
        <div className="mt-1 text-sm text-amber-800">
          Чернетка на базі {baseVersion}. Після публікації: {nextVersion}.
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="rounded-2xl border border-amber-200 bg-[var(--enver-card)] px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
        >
          Попередній перегляд changes
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-2xl border border-amber-200 bg-[var(--enver-card)] px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
        >
          Discard
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onPublish}
          className={cn(
            "rounded-2xl px-4 py-2 text-sm font-medium text-white transition",
            disabled ? "cursor-not-allowed bg-zinc-300" : "bg-zinc-950 hover:bg-zinc-800",
          )}
        >
          {saving ? "Зберігаємо..." : `Створити ${nextVersion}`}
        </button>
      </div>
    </div>
  );
}

function MetaStrip({
  estimateName,
  setEstimateName,
  mode,
  currency,
  basedOn,
  changeNote,
  setChangeNote,
}: {
  estimateName: string;
  setEstimateName: (value: string) => void;
  mode: PageMode;
  currency: string;
  basedOn?: string;
  changeNote: string;
  setChangeNote: (value: string) => void;
}) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Estimate name">
          <input
            value={estimateName}
            onChange={(e) => setEstimateName(e.target.value)}
            disabled={mode !== "draft"}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-80"
            placeholder="Назва розрахунку"
          />
        </Field>
        <Field label="Version source">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {basedOn ?? "Current view"}
          </div>
        </Field>
        <Field label="Currency">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {currency}
          </div>
        </Field>
        <Field label="Change note">
          <input
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            disabled={mode !== "draft"}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-80"
            placeholder="Що змінилось у цій версії"
          />
        </Field>
      </div>
    </section>
  );
}

function SectionTitle({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <span className="rounded-xl bg-zinc-100 p-2 text-zinc-700">{icon}</span>
          {title}
        </div>
        <p className="mt-2 text-sm text-zinc-600">{description}</p>
      </div>
      {action}
    </div>
  );
}

function ReadonlyItemCard({
  item,
  currency,
}: {
  item: VersionItem;
  currency: string;
}) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone="zinc">{item.category || "Без категорії"}</StatusChip>
            {item.supplier ? <StatusChip tone="blue">{item.supplier}</StatusChip> : null}
            {item.unitPriceSource === "manual" ? (
              <StatusChip tone="amber">Manual price</StatusChip>
            ) : (
              <StatusChip tone="green">Supplier snapshot</StatusChip>
            )}
          </div>
          <div className="mt-3 text-base font-semibold text-zinc-950">{item.title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
            {item.supplierMaterialCode ? <span>Код: {item.supplierMaterialCode}</span> : null}
            {item.supplierPriceSnapshot ? (
              <span>Знімок: {formatDate(item.supplierPriceSnapshot.capturedAt)}</span>
            ) : null}
          </div>
          {item.note ? <div className="mt-2 text-sm text-zinc-500">{item.note}</div> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[420px]">
          <MiniStat label="Qty" value={String(item.qty)} />
          <MiniStat label="Coef" value={String(item.coefficient)} />
          <MiniStat label="Unit price" value={formatMoney(item.unitPrice, currency)} />
          <MiniStat label="Total" value={formatMoney(item.totalPrice, currency)} strong />
        </div>
      </div>
    </div>
  );
}

function EditableItemCard({
  item,
  marker,
  searchQuery,
  searchResults,
  searchLoading,
  onSearchQueryChange,
  onChange,
  onSelectMaterial,
  onDuplicate,
  onRemove,
  onResetSupplierPrice,
}: {
  item: DraftItem;
  marker: "added" | "changed" | null;
  searchQuery: string;
  searchResults: MaterialSearchResult[];
  searchLoading: boolean;
  onSearchQueryChange: (value: string) => void;
  onChange: (patch: Partial<DraftItem>) => void;
  onSelectMaterial: (material: MaterialSearchResult) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onResetSupplierPrice: () => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div
      className={cn(
        "rounded-[24px] border p-4 transition",
        marker === "added"
          ? "border-emerald-200 bg-emerald-50/50"
          : marker === "changed"
            ? "border-blue-200 bg-blue-50/50"
            : "border-zinc-200 bg-zinc-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="mt-1 rounded-xl bg-[var(--enver-card)] p-2 text-zinc-500 shadow-sm">
            <GripVertical className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-900">Позиція #{item.sortOrder}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {marker === "added" ? <StatusChip tone="green">Added</StatusChip> : null}
              {marker === "changed" ? <StatusChip tone="blue">Changed</StatusChip> : null}
              {item.supplier ? <StatusChip tone="zinc">{item.supplier}</StatusChip> : null}
              {item.unitPriceSource === "manual" ? (
                <StatusChip tone="amber">Manual price</StatusChip>
              ) : item.supplierPriceSnapshot ? (
                <StatusChip tone="green">Supplier snapshot</StatusChip>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <IconActionButton icon={<Copy className="h-4 w-4" />} onClick={onDuplicate} />
          <IconActionButton icon={<Trash2 className="h-4 w-4" />} onClick={onRemove} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[180px_minmax(0,1fr)_minmax(0,1.2fr)]">
        <Field label="Category">
          <select
            value={item.category ?? ""}
            onChange={(e) => onChange({ category: e.target.value || null })}
            className="w-full rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-3 text-sm outline-none transition focus:border-zinc-400"
          >
            <option value="">Оберіть категорію</option>
            <option value="Корпус">Корпус</option>
            <option value="Фасад">Фасад</option>
            <option value="Фурнітура">Фурнітура</option>
            <option value="Монтаж">Монтаж</option>
            <option value="Доставка">Доставка</option>
            <option value="Інше">Інше</option>
          </select>
        </Field>
        <Field label="Title">
          <input
            value={item.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="w-full rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
            placeholder="Назва позиції"
          />
        </Field>
        <Field label="Material search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={searchQuery}
              onFocus={() => setDropdownOpen(true)}
              onChange={(e) => {
                setDropdownOpen(true);
                onSearchQueryChange(e.target.value);
              }}
              className="w-full rounded-2xl border border-zinc-200 bg-[var(--enver-card)] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-zinc-400"
              placeholder="Знайти матеріал або код"
            />
            {dropdownOpen ? (
              <div className="absolute z-20 mt-2 w-full rounded-2xl border border-zinc-200 bg-[var(--enver-card)] p-2 shadow-xl">
                {searchLoading ? (
                  <div className="rounded-xl bg-zinc-50 px-3 py-4 text-sm text-zinc-600">Пошук...</div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-1">
                    {searchResults.map((material) => (
                      <button
                        key={material.materialId}
                        type="button"
                        onClick={() => {
                          onSelectMaterial(material);
                          setDropdownOpen(false);
                        }}
                        className="block w-full rounded-xl px-3 py-3 text-left transition hover:bg-zinc-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-zinc-900">{material.name}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span>Код: {material.code}</span>
                              <span>•</span>
                              <span>{material.supplier}</span>
                              {material.attrs?.slice(0, 2).map((attr) => (
                                <span
                                  key={attr}
                                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600"
                                >
                                  {attr}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="whitespace-nowrap text-sm font-semibold text-zinc-900">
                            {formatMoney(material.price, material.currency)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-zinc-50 px-3 py-4 text-sm text-zinc-600">
                    <div>Нічого не знайдено</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Можна залишити ручну назву і ціну.
                    </div>
                  </div>
                )}
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(false)}
                    className="rounded-xl px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50"
                  >
                    Закрити </button>
                </div>
              </div>
            ) : null}
          </div>
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Qty">
          <NumberInput value={item.qty} onChange={(v) => onChange({ qty: v })} />
        </Field>
        <Field label="Coefficient">
          <NumberInput
            value={item.coefficient}
            onChange={(v) => onChange({ coefficient: v })}
            step="0.1"
          />
        </Field>
        <Field label="Unit price">
          <NumberInput value={item.unitPrice} onChange={(v) => onChange({ unitPrice: v })} />
        </Field>
        <Field label="Total">
          <div className="rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-3 text-sm font-semibold text-zinc-950">
            {formatMoney(item.totalPrice)}
          </div>
        </Field>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
        <Field label="Internal note">
          <input
            value={item.note ?? ""}
            onChange={(e) => onChange({ note: e.target.value })}
            className="w-full rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
            placeholder="Коментар до позиції"
          />
        </Field>
        <div className="space-y-2 rounded-2xl border border-zinc-200 bg-[var(--enver-card)] p-3 text-xs text-zinc-600">
          <div className="font-medium text-zinc-800">Supplier data</div>
          <div>{item.supplierMaterialCode ? `Код: ${item.supplierMaterialCode}` : "Код не вибрано"}</div>
          <div>
            {item.supplierPriceSnapshot
              ? `Знімок: ${formatMoney(item.supplierPriceSnapshot.price, item.supplierPriceSnapshot.currency)}`
              : "Знімок відсутній"}
          </div>
          <button
            type="button"
            disabled={!item.supplierPriceSnapshot}
            onClick={onResetSupplierPrice}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset supplier price
          </button>
        </div>
      </div>
    </div>
  );
}

function TotalsBlock({
  total,
  subtotal,
  itemsCount,
  manualAdjustments,
  delta,
  currency,
}: {
  total: number;
  subtotal: number;
  itemsCount: number;
  manualAdjustments: number;
  delta: number;
  currency: string;
}) {
  const deltaLabel = `${delta > 0 ? "+" : ""}${formatMoney(delta, currency)}`;
  return (
    <div className="mt-5 rounded-[24px] bg-zinc-950 p-5 text-white shadow-lg shadow-zinc-950/10">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))] lg:items-end">
        <div>
          <div className="text-sm text-zinc-300">Final total</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{formatMoney(total, currency)}</div>
        </div>
        <BigMini label="Subtotal" value={formatMoney(subtotal, currency)} />
        <BigMini label="Items" value={String(itemsCount)} />
        <BigMini label="Manual prices" value={String(manualAdjustments)} />
        <BigMini label="Delta vs previous" value={deltaLabel} />
      </div>
    </div>
  );
}

function DiffPreview({
  diff,
  currency,
  title,
}: {
  diff: DiffResult;
  currency: string;
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
      <SectionTitle
        icon={<History className="h-4 w-4" />}
        title={title}
        description="Додано, видалено, змінено, total delta."
      />
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryMiniCard label="Added" value={String(diff.added.length)} />
        <SummaryMiniCard label="Removed" value={String(diff.removed.length)} />
        <SummaryMiniCard label="Changed" value={String(diff.changed.length)} />
        <SummaryMiniCard label="Total delta" value={formatMoney(diff.totalDelta, currency)} />
      </div>
      <div className="mt-5 space-y-5">
        <DiffGroup title="Added items" count={diff.added.length}>
          {diff.added.length === 0 ? (
            <EmptyDiffText />
          ) : (
            <div className="space-y-3">
              {diff.added.map((item) => (
                <div key={item.tempId} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-zinc-900">{item.title || "Без назви"}</div>
                      <div className="mt-1 text-sm text-zinc-600">{item.category || "Без категорії"}</div>
                    </div>
                    <StatusChip tone="green">Added</StatusChip>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-700">
                    <span>Qty: {item.qty}</span>
                    <span>Coef: {item.coefficient}</span>
                    <span>Unit: {formatMoney(item.unitPrice, currency)}</span>
                    <span>Total: {formatMoney(item.totalPrice, currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DiffGroup>
        <DiffGroup title="Removed items" count={diff.removed.length}>
          {diff.removed.length === 0 ? (
            <EmptyDiffText />
          ) : (
            <div className="space-y-3">
              {diff.removed.map((item) => (
                <div key={item.id} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-zinc-900">{item.title}</div>
                      <div className="mt-1 text-sm text-zinc-600">{item.category || "Без категорії"}</div>
                    </div>
                    <StatusChip tone="rose">Removed</StatusChip>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-700">
                    <span>Qty: {item.qty}</span>
                    <span>Coef: {item.coefficient}</span>
                    <span>Unit: {formatMoney(item.unitPrice, currency)}</span>
                    <span>Total: {formatMoney(item.totalPrice, currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DiffGroup>
        <DiffGroup title="Changed items" count={diff.changed.length}>
          {diff.changed.length === 0 ? (
            <EmptyDiffText />
          ) : (
            <div className="space-y-3">
              {diff.changed.map((item) => (
                <div key={item.baseItemId} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-zinc-900">{item.title}</div>
                    <StatusChip tone="blue">Changed</StatusChip>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-zinc-700">
                    {item.fields.map((field) => (
                      <div key={field.field} className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-zinc-900">{field.field}:</span>
                        <span>{String(field.from)}</span>
                        <span>→</span>
                        <span>{String(field.to)}</span>
                      </div>
                    ))}
                    <div className="pt-1 text-sm font-medium text-zinc-900">
                      Total: {formatMoney(item.beforeTotal, currency)} → {formatMoney(item.afterTotal, currency)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DiffGroup>
      </div>
    </section>
  );
}

function BottomActionBar({
  nextVersion,
  total,
  disabled,
  saving,
  onDiscard,
  onPublish,
}: {
  nextVersion: string;
  total: number;
  disabled: boolean;
  saving: boolean;
  onDiscard: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="sticky bottom-4 z-30 flex flex-col gap-3 rounded-[28px] border border-zinc-200 bg-[var(--enver-card)]/95 p-4 shadow-2xl backdrop-blur md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-sm text-zinc-500">Готово до створення версії</div>
        <div className="mt-1 text-lg font-semibold text-zinc-950">
          {nextVersion} • {formatMoney(total)}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
        >
          Discard draft
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onPublish}
          className={cn(
            "rounded-2xl px-4 py-2 text-sm font-medium text-white transition",
            disabled ? "cursor-not-allowed bg-zinc-300" : "bg-zinc-950 hover:bg-zinc-800",
          )}
        >
          {saving ? "Зберігаємо..." : `Створити ${nextVersion}`}
        </button>
      </div>
    </div>
  );
}

function Sidebar({
  mode,
  currentVersion,
  selectedVersion,
  compareFrom,
  compareTo,
  draftTotal,
  draftItemsCount,
  diff,
  versions,
  compareFromId,
  compareToId,
  onSelectVersion,
  onUseAsBase,
  onCompare,
  onChangeCompareFrom,
  onChangeCompareTo,
  onOpenCompareMode,
  onNewVersion,
  onCreateFirst,
  hasEstimate,
  leadId,
  estimateId,
}: {
  mode: PageMode;
  currentVersion: EstimateVersion | null;
  selectedVersion: EstimateVersion | null;
  compareFrom: EstimateVersion | null;
  compareTo: EstimateVersion | null;
  draftTotal: number;
  draftItemsCount: number;
  diff: DiffResult | null;
  versions: EstimateVersion[];
  compareFromId: string | null;
  compareToId: string | null;
  onSelectVersion: (id: string) => void;
  onUseAsBase: (id: string) => void;
  onCompare: (id: string) => void;
  onChangeCompareFrom: (id: string) => void;
  onChangeCompareTo: (id: string) => void;
  onOpenCompareMode: () => void;
  onNewVersion: () => void;
  onCreateFirst: () => void;
  hasEstimate: boolean;
  leadId: string;
  estimateId: string | null;
}) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
      <div className="rounded-[28px] border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
        <div className="text-sm font-semibold text-zinc-900">Summary</div>
        <div className="mt-4 space-y-3">
          <SidebarRow
            label="State"
            value={
              mode === "draft"
                ? "Draft"
                : mode === "compare"
                  ? "Compare"
                  : mode === "empty"
                    ? "Empty"
                    : "View"
            }
          />
          <SidebarRow
            label="Version"
            value={mode === "draft" ? "Draft" : selectedVersion ? `v${selectedVersion.versionNumber}` : "—"}
          />
          <SidebarRow
            label="Total"
            value={
              mode === "draft"
                ? formatMoney(draftTotal)
                : formatMoney(selectedVersion?.total || 0)
            }
            strong
          />
          <SidebarRow
            label="Items"
            value={
              mode === "draft"
                ? String(draftItemsCount)
                : String(selectedVersion?.items.length || 0)
            }
          />
          <SidebarRow
            label="Current"
            value={currentVersion ? `v${currentVersion.versionNumber}` : "—"}
          />
          <SidebarRow
            label="Updated"
            value={selectedVersion ? formatDate(selectedVersion.createdAt) : "—"}
          />
          {diff ? <SidebarRow label="Delta" value={formatMoney(diff.totalDelta)} strong /> : null}
        </div>
      </div>

      <div className="rounded-[28px] border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-zinc-900">Version history</div>
          {hasEstimate ? (
            <button
              type="button"
              onClick={onNewVersion}
              className="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800"
            >
              New version
            </button>
          ) : (
            <button
              type="button"
              onClick={onCreateFirst}
              className="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800"
            >
              First estimate
            </button>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {versions.length === 0 ? (
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">Ще немає версій</div>
          ) : (
            versions.map((version) => (
              <div key={version.id} className="rounded-2xl border border-zinc-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-zinc-900">v{version.versionNumber}</div>
                      <StatusChip tone={version.status === "current" ? "green" : "zinc"}>{version.status}</StatusChip>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">{version.createdBy}</div>
                    <div className="mt-1 text-xs text-zinc-500">{formatDate(version.createdAt)}</div>
                    <div className="mt-2 text-sm font-medium text-zinc-900">{formatMoney(version.total)}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectVersion(version.id)}
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => onCompare(version.id)}
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50"
                    >
                      Compare
                    </button>
                    <button
                      type="button"
                      onClick={() => onUseAsBase(version.id)}
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50"
                    >
                      Use as base
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {versions.length > 0 ? (
        <div className="rounded-[28px] border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
          <div className="text-sm font-semibold text-zinc-900">Compare versions</div>
          <div className="mt-4 space-y-3">
            <Field label="From">
              <select
                value={compareFromId ?? ""}
                onChange={(e) => onChangeCompareFrom(e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-400"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber} — {v.status}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="To">
              <select
                value={compareToId ?? ""}
                onChange={(e) => onChangeCompareTo(e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-400"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber} — {v.status}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              onClick={onOpenCompareMode}
              className="w-full rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
            >
              Відкрити compare
            </button>
            <div className="rounded-2xl bg-zinc-50 p-3 text-xs text-zinc-600">
              {compareFrom && compareTo
                ? `v${compareFrom.versionNumber} → v${compareTo.versionNumber}`
                : "Оберіть версії"}
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-[28px] border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
        <div className="text-sm font-semibold text-zinc-900">Quick actions</div>
        <div className="mt-4 grid gap-2">
          {hasEstimate ? (
            <QuickSidebarButton icon={<Plus className="h-4 w-4" />} label="New version" onClick={onNewVersion} />
          ) : (
            <QuickSidebarButton
              icon={<Plus className="h-4 w-4" />}
              label="Створити first estimate"
              onClick={onCreateFirst}
            />
          )}
          <QuickSidebarButton
            icon={<FileText className="h-4 w-4" />}
            label="Створити proposal"
            onClick={() => alert("Proposal create action")}
          />
          <QuickSidebarButton
            icon={<PackageSearch className="h-4 w-4" />}
            label="Відкрити client files"
            onClick={() => alert("Відкрити lead files")}
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
        <div className="text-sm font-semibold text-zinc-900">Metadata</div>
        <div className="mt-4 space-y-3 text-sm text-zinc-600">
          <SidebarRow label="Lead id" value={leadId} />
          <SidebarRow label="Estimate id" value={estimateId ?? "—"} />
          <SidebarRow label="History size" value={String(versions.length)} />
          <SidebarRow label="Flow" value="Versioned composer (demo)" />
        </div>
      </div>
    </aside>
  );
}

function ImplementationAppendix() {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
      <SectionTitle
        icon={<Clock3 className="h-4 w-4" />}
        title="Implementation appendix"
        description="Contracts для винесення в Prisma/API (демо)."
      />
      <div className="mt-5 space-y-5 text-sm text-zinc-700">
        <div>
          <div className="font-semibold text-zinc-900">Prisma schema draft</div>
          <CodeBlock content={PRISMA_SCHEMA} />
        </div>
        <div>
          <div className="font-semibold text-zinc-900">REST API draft</div>
          <CodeBlock content={API_CONTRACTS} />
        </div>
        <ul className="mt-2 space-y-2 text-zinc-600">
          <li>• FakeEstimateRepo → реальний API.</li>
          <li>• Total перераховує сервер.</li>
          <li>• Publish — transaction: archive current → new current.</li>
        </ul>
      </div>
    </section>
  );
}

const PRISMA_SCHEMA = String.raw`model Lead {
  id                String            @id @default(cuid())
  title             String
  estimates         Estimate[]
}
model Estimate {
  id                String            @id @default(cuid())
  leadId            String
  currentVersionId  String?
  versions          EstimateVersion[]
}`;

const API_CONTRACTS = String.raw`GET /api/leads/:leadId/estimate-workspace
POST /api/leads/:leadId/estimates
PATCH /api/leads/:leadId/estimates/:id (fork)
GET /api/materials/search?q=`;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      {children}
    </label>
  );
}

function StatusChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "green" | "blue" | "amber" | "rose" | "zinc";
}) {
  const styles = {
    green: "bg-emerald-100 text-emerald-800 border-emerald-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    rose: "bg-rose-100 text-rose-800 border-rose-200",
    zinc: "bg-zinc-100 text-zinc-700 border-zinc-200",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}>
      {children}
    </span>
  );
}

function MiniStat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-[var(--enver-card)] p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={cn("mt-2 text-sm text-zinc-900", strong && "font-semibold")}>{value}</div>
    </div>
  );
}

function BigMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-2 text-lg font-medium text-white">{value}</div>
    </div>
  );
}

function SummaryMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function SidebarRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-zinc-500">{label}</div>
      <div className={cn("text-right text-zinc-900", strong && "font-semibold")}>{value}</div>
    </div>
  );
}

function IconActionButton({ icon, onClick }: { icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-[var(--enver-card)] text-zinc-700 transition hover:bg-zinc-50"
    >
      {icon}
    </button>
  );
}

function NumberInput({
  value,
  onChange,
  step = "1",
}: {
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <input
      type="number"
      value={Number.isNaN(value) ? 0 : value}
      step={step}
      min="0"
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-3 text-sm outline-none transition focus:border-zinc-400"
    />
  );
}

function DiffGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="text-sm font-semibold text-zinc-900">{title}</div>
        <StatusChip tone="zinc">{count}</StatusChip>
      </div>
      {children}
    </div>
  );
}

function EmptyDiffText() {
  return <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">Змін у цій групі немає</div>;
}

function QuickSidebarButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      <ChevronRight className="h-4 w-4 text-zinc-400" />
    </button>
  );
}

function QuickAddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50"
    >
      + {label}
    </button>
  );
}

function CodeBlock({ content }: { content: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">
      <code>{content}</code>
    </pre>
  );
}
