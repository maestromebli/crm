"use client";

/**
 * Робоче місце «Розрахунок» по ліду: таблиця «Кухня без стільниці», версії, КП.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  FileText,
  LayoutGrid,
  Layers,
  Loader2,
  Plus,
  Save,
} from "lucide-react";
import type {
  LeadEstimateSummary,
  LeadProposalSummary,
} from "../../../features/leads/queries";
import { patchLeadEstimateById } from "../../../features/leads/lead-estimate-api";
import { postJson } from "../../../lib/api/patch-json";
import { parseResponseJson } from "../../../lib/api/parse-response-json";
import { parseEstimateLineBreakdown } from "../../../lib/estimates/estimate-line-breakdown";
import {
  detectTemplateKeyByEstimateName,
  getTemplateTitle,
  KITCHEN_CLIENT_PRICE_MULTIPLIER,
  KITCHEN_MARKUP_PERCENT_LABEL,
  KITCHEN_NO_COUNTER_TEMPLATE_KEY,
  withFurnitureBlockKind,
  type FurnitureBlockKind,
  type FurnitureTemplateKey,
  type KitchenSheetMetadata,
} from "../../../lib/estimates/kitchen-cost-sheet-template";
import {
  FURNITURE_TEMPLATES,
  getFurnitureTemplateMeta,
  isFurnitureTemplateKey,
} from "../../../lib/estimates/furniture-estimate-templates";
import { recalculateEstimateTotals } from "../../../lib/estimates/recalculate";
import { estimateLinesToQuoteItems } from "../../../lib/quotes/estimate-to-quote-items";
import { lookupViyarPriceByName } from "../../../lib/estimates/viyar-price-lookup";
import { cn } from "../../../lib/utils";
import type { MaterialSearchHit } from "../../../lib/materials/material-provider";
import type { EstimateLineDraft, LineType } from "./estimate-line-draft";
import { CreateProposalModal } from "../lead-estimate/CreateProposalModal";
import { KitchenCostSheetTable } from "./KitchenCostSheetTable";
import { PricingAiHelpPanel } from "./PricingAiHelpPanel";
import {
  iconForBlockKind,
  nextBlockLabel,
  seedRowsForFurnitureBlock,
} from "./seed-furniture-block";

export type { EstimateLineDraft } from "./estimate-line-draft";

type EstimatePayload = {
  id: string;
  name: string | null;
  version: number;
  status: string;
  templateKey: string | null;
  totalPrice: number | null;
  totalCost: number | null;
  grossMargin: number | null;
  discountAmount: number | null;
  deliveryCost: number | null;
  installationCost: number | null;
  notes: string | null;
  changeSummary: string | null;
  lineItems: EstimateLineDraft[];
};

const STATUS_OPTIONS = [
  { v: "DRAFT", label: "Чернетка" },
  { v: "SENT", label: "Надіслано" },
  { v: "APPROVED", label: "Погоджено" },
  { v: "REJECTED", label: "Відхилено" },
] as const;

const PRICING_VIEW_KEY = "enver.leadPricing.viewMode";
const PRICING_ROLE_KEY = "enver.leadPricing.rolePreset";

export type PricingViewMode = "compact" | "standard" | "pro";
export type PricingRolePreset = "manager" | "technologist";

function formatUah(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return (
    new Intl.NumberFormat("uk-UA", {
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n) + " грн"
  );
}

function formatUahCompact(n: number | null | undefined): string | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return `${new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n)} грн`;
}

function normalizeMaterialName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function pickBestMaterialHit(
  query: string,
  items: MaterialSearchHit[],
): MaterialSearchHit | null {
  if (!items.length) return null;
  const q = normalizeMaterialName(query);
  const exact = items.find((x) => normalizeMaterialName(x.label) === q);
  if (exact) return exact;
  const starts = items.find((x) => normalizeMaterialName(x.label).startsWith(q));
  if (starts) return starts;
  return items[0] ?? null;
}

function mapApiLine(
  li: Record<string, unknown>,
): EstimateLineDraft {
  const meta = parseEstimateLineBreakdown(li.metadataJson);
  const raw = li.metadataJson;
  const rawObj: Record<string, unknown> =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  let coefficient = 1;
  let kitchenRole: EstimateLineDraft["kitchenRole"];
  let rowStyle: EstimateLineDraft["rowStyle"];
  if (raw && typeof raw === "object") {
    if (
      typeof rawObj.coefficient === "number" &&
      Number.isFinite(rawObj.coefficient)
    ) {
      coefficient = rawObj.coefficient;
    }
    if (
      rawObj.kitchenRole === "material" ||
      rawObj.kitchenRole === "measurement"
    ) {
      kitchenRole = rawObj.kitchenRole;
    }
    if (rawObj.rowStyle === "tan" || rawObj.rowStyle === "orange") {
      rowStyle = rawObj.rowStyle;
    }
  }
  let furnitureBlockKind: EstimateLineDraft["furnitureBlockKind"];
  if (
    typeof rawObj.furnitureBlockKind === "string" &&
    isFurnitureTemplateKey(rawObj.furnitureBlockKind)
  ) {
    furnitureBlockKind = rawObj.furnitureBlockKind;
  }
  return {
    id: String(li.id ?? ""),
    type: (li.type as LineType) ?? "PRODUCT",
    category:
      typeof li.category === "string" && li.category.trim()
        ? li.category.trim()
        : null,
    productName: String(li.productName ?? ""),
    qty: typeof li.qty === "number" ? li.qty : 0,
    unit: typeof li.unit === "string" ? li.unit : "шт",
    salePrice: typeof li.salePrice === "number" ? li.salePrice : 0,
    costPrice:
      typeof li.costPrice === "number" || li.costPrice === null
        ? (li.costPrice as number | null)
        : undefined,
    amountSale: typeof li.amountSale === "number" ? li.amountSale : 0,
    amountCost:
      typeof li.amountCost === "number" || li.amountCost === null
        ? (li.amountCost as number | null)
        : undefined,
    coefficient,
    groupId: typeof rawObj.groupId === "string" ? rawObj.groupId : undefined,
    groupLabel:
      typeof rawObj.groupLabel === "string" ? rawObj.groupLabel : undefined,
    groupIcon:
      typeof rawObj.groupIcon === "string" ? rawObj.groupIcon : undefined,
    templateKey:
      typeof rawObj.templateKey === "string" ? rawObj.templateKey : undefined,
    ...(kitchenRole ? { kitchenRole } : {}),
    ...(rowStyle ? { rowStyle } : {}),
    ...(furnitureBlockKind ? { furnitureBlockKind } : {}),
    ...(typeof rawObj.tableTitle === "string" && rawObj.tableTitle.trim()
      ? { tableTitle: rawObj.tableTitle.trim().slice(0, 200) }
      : {}),
    ...(typeof rawObj.kitchenClientPriceMultiplier === "number" &&
    Number.isFinite(rawObj.kitchenClientPriceMultiplier) &&
    rawObj.kitchenClientPriceMultiplier > 0
      ? { kitchenClientPriceMultiplier: rawObj.kitchenClientPriceMultiplier }
      : {}),
    ...(typeof rawObj.kitchenMaterialMarkupPercent === "number" &&
    Number.isFinite(rawObj.kitchenMaterialMarkupPercent) &&
    rawObj.kitchenMaterialMarkupPercent > 0
      ? { kitchenMaterialMarkupPercent: rawObj.kitchenMaterialMarkupPercent }
      : {}),
    ...(meta ? { metadataJson: meta } : {}),
  };
}

/**
 * Метадані меблевого рядка для PATCH. Завжди зберігаємо furnitureBlockKind / групи /
 * кухонні поля — інакше після перезавантаження блок «додатковий тип» зливається з основним.
 */
function buildKitchenSheetMetadataForSave(
  li: EstimateLineDraft,
  fallbackTemplateKey: FurnitureTemplateKey,
): KitchenSheetMetadata {
  const m: KitchenSheetMetadata = {
    kitchenSheet: true,
    templateKey:
      (li.templateKey as FurnitureTemplateKey | undefined) ??
      fallbackTemplateKey ??
      KITCHEN_NO_COUNTER_TEMPLATE_KEY,
    groupId: li.groupId ?? "custom",
    groupLabel: li.groupLabel ?? "Інше",
    groupIcon: li.groupIcon ?? "📦",
    kitchenRole: li.kitchenRole ?? "material",
    coefficient: li.coefficient ?? 1,
    ...(li.rowStyle ? { rowStyle: li.rowStyle } : {}),
    ...(li.tableTitle?.trim()
      ? { tableTitle: li.tableTitle.trim().slice(0, 200) }
      : {}),
    ...(li.kitchenClientPriceMultiplier != null &&
    Number.isFinite(li.kitchenClientPriceMultiplier) &&
    li.kitchenClientPriceMultiplier > 0
      ? { kitchenClientPriceMultiplier: li.kitchenClientPriceMultiplier }
      : {}),
    ...(li.kitchenMaterialMarkupPercent != null &&
    Number.isFinite(li.kitchenMaterialMarkupPercent) &&
    li.kitchenMaterialMarkupPercent > 0
      ? { kitchenMaterialMarkupPercent: li.kitchenMaterialMarkupPercent }
      : {}),
  };
  return withFurnitureBlockKind(m, li.furnitureBlockKind ?? null);
}

function metadataJsonForSave(
  li: EstimateLineDraft,
  fallbackTemplateKey: FurnitureTemplateKey,
): object | null | undefined {
  if (li.metadataJson?.components?.length) {
    const sheet = buildKitchenSheetMetadataForSave(li, fallbackTemplateKey);
    const br = li.metadataJson as unknown as {
      v: unknown;
      components: unknown;
    };
    return { ...sheet, v: br.v, components: br.components } as object;
  }
  return buildKitchenSheetMetadataForSave(li, fallbackTemplateKey);
}

/** Окремі розрахункові таблиці за типом меблевого блоку (кухня, шафа, …). */
function partitionLinesByBlockKind(
  all: EstimateLineDraft[],
): Array<{ blockKind: FurnitureBlockKind | null; lines: EstimateLineDraft[] }> {
  const byKey = new Map<string, EstimateLineDraft[]>();
  for (const li of all) {
    const k = li.furnitureBlockKind ?? "__none__";
    const arr = byKey.get(k) ?? [];
    arr.push(li);
    byKey.set(k, arr);
  }
  const out: Array<{
    blockKind: FurnitureBlockKind | null;
    lines: EstimateLineDraft[];
  }> = [];
  for (const t of FURNITURE_TEMPLATES) {
    const arr = byKey.get(t.key);
    if (arr?.length) out.push({ blockKind: t.key, lines: arr });
  }
  const rest = byKey.get("__none__");
  if (rest?.length) out.push({ blockKind: null, lines: rest });
  return out;
}

function sheetTitleForBlockPartition(
  blockKind: FurnitureBlockKind | null,
  sheetKey: FurnitureTemplateKey,
): string {
  if (blockKind) {
    return (
      getFurnitureTemplateMeta(blockKind)?.label ?? getTemplateTitle(sheetKey)
    );
  }
  return `Інші позиції · ${getTemplateTitle(sheetKey)}`;
}

const uid = () => `t_${Math.random().toString(36).slice(2, 11)}`;

export type LeadPricingWorkspaceClientProps = {
  leadId: string;
  leadTitle: string;
  /** Лід уже конвертований — смета в угоді. */
  leadConverted: boolean;
  initialEstimates: LeadEstimateSummary[];
  initialProposals: LeadProposalSummary[];
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  /** Показувати колонку собівартості (право COST_VIEW). */
  showCostFields: boolean;
  /** Прокрутка до блоку смети або КП після завантаження (вкладки «Розрахунок» / «КП»). */
  scrollToSection?: "estimate" | "kp";
  /** Зображення з файлів ліда — автопідстановка URL у КП. */
  leadImageUrlsForKp?: string[];
  /** Id угоди після конверсії (посилання з заблокованого розділу). */
  leadDealId?: string | null;
};

export function LeadPricingWorkspaceClient({
  leadId,
  leadTitle,
  leadConverted,
  initialEstimates,
  initialProposals,
  canView,
  canCreate,
  canUpdate,
  showCostFields,
  scrollToSection,
  leadImageUrlsForKp,
  leadDealId,
}: LeadPricingWorkspaceClientProps) {
  const router = useRouter();
  const [estimates, setEstimates] = useState(initialEstimates);
  const [activeEstimateId, setActiveEstimateId] = useState<string | null>(null);
  const [proposals, setProposals] = useState(initialProposals);
  const [kpBusy, setKpBusy] = useState(false);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialEstimates[0]?.id ?? null,
  );
  const [estimate, setEstimate] = useState<EstimatePayload | null>(null);
  const [lines, setLines] = useState<EstimateLineDraft[]>([]);
  const [notes, setNotes] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [installationCost, setInstallationCost] = useState(0);
  const [status, setStatus] = useState<string>("DRAFT");
  const [loadBusy, setLoadBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forkOnSave, setForkOnSave] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiHints, setAiHints] = useState<string[]>([]);
  const [materialLookupBusy, setMaterialLookupBusy] = useState(false);
  const inFlightLookupRef = useRef<Set<string>>(new Set());
  const resolvedNameByLineRef = useRef<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<PricingViewMode>("standard");
  const [rolePreset, setRolePreset] = useState<PricingRolePreset>("manager");
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(PRICING_VIEW_KEY);
      if (v === "compact" || v === "standard" || v === "pro") {
        setViewMode(v);
      }
      const r = localStorage.getItem(PRICING_ROLE_KEY);
      if (r === "manager" || r === "technologist") {
        setRolePreset(r);
      }
    } catch {
      /* noop */
    }
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    try {
      localStorage.setItem(PRICING_VIEW_KEY, viewMode);
    } catch {
      /* noop */
    }
  }, [viewMode, prefsHydrated]);

  useEffect(() => {
    if (!prefsHydrated) return;
    try {
      localStorage.setItem(PRICING_ROLE_KEY, rolePreset);
    } catch {
      /* noop */
    }
  }, [rolePreset, prefsHydrated]);

  useEffect(() => {
    if (!scrollToSection || !estimates.length) return;
    if (loadBusy && !estimate) return;
    const anchorId =
      scrollToSection === "kp"
        ? "lead-pricing-kp-anchor"
        : "lead-pricing-estimate-anchor";
    const timer = window.setTimeout(() => {
      document.getElementById(anchorId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [
    scrollToSection,
    estimates.length,
    loadBusy,
    estimate,
    selectedId,
  ]);

  const loadEstimate = useCallback(
    async (estimateId: string) => {
      setLoadBusy(true);
      setErr(null);
      try {
        const r = await fetch(`/api/leads/${leadId}/estimates/${estimateId}`);
        const j = await parseResponseJson<{
          estimate?: Record<string, unknown>;
          error?: string;
        }>(r);
        if (!r.ok) throw new Error(j.error ?? "Не вдалося завантажити");
        const e = j.estimate;
        if (!e || typeof e !== "object") throw new Error("Немає даних");
        const lis = Array.isArray(e.lineItems)
          ? (e.lineItems as Record<string, unknown>[]).map(mapApiLine)
          : [];
        setEstimate({
          id: String(e.id),
          name: typeof e.name === "string" && e.name.trim() ? e.name.trim() : null,
          version: Number(e.version),
          status: String(e.status ?? "DRAFT"),
          templateKey:
            typeof e.templateKey === "string" && e.templateKey.trim()
              ? e.templateKey
              : null,
          totalPrice: typeof e.totalPrice === "number" ? e.totalPrice : null,
          totalCost: typeof e.totalCost === "number" ? e.totalCost : null,
          grossMargin:
            typeof e.grossMargin === "number" ? e.grossMargin : null,
          discountAmount:
            typeof e.discountAmount === "number" ? e.discountAmount : null,
          deliveryCost:
            typeof e.deliveryCost === "number" ? e.deliveryCost : null,
          installationCost:
            typeof e.installationCost === "number"
              ? e.installationCost
              : null,
          notes: typeof e.notes === "string" ? e.notes : null,
          changeSummary:
            typeof e.changeSummary === "string" ? e.changeSummary : null,
          lineItems: lis,
        });
        setLines(lis);
        setNotes(typeof e.notes === "string" ? e.notes : "");
        setDiscountAmount(
          typeof e.discountAmount === "number" ? e.discountAmount : 0,
        );
        setDeliveryCost(
          typeof e.deliveryCost === "number" ? e.deliveryCost : 0,
        );
        setInstallationCost(
          typeof e.installationCost === "number" ? e.installationCost : 0,
        );
        setStatus(String(e.status ?? "DRAFT"));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Помилка");
        setEstimate(null);
        setLines([]);
      } finally {
        setLoadBusy(false);
      }
    },
    [leadId],
  );

  useEffect(() => {
    if (!selectedId || !canView) return;
    void loadEstimate(selectedId);
  }, [selectedId, canView, loadEstimate]);

  const refreshList = useCallback(async () => {
    const r = await fetch(`/api/leads/${leadId}/estimates`);
    const j = await parseResponseJson<{
      activeEstimateId?: string | null;
      items?: LeadEstimateSummary[];
    }>(r);
    if (r.ok && j.items) {
      if (typeof j.activeEstimateId === "string" && j.activeEstimateId) {
        setActiveEstimateId(j.activeEstimateId);
      } else {
        setActiveEstimateId(null);
      }
      setEstimates(
        j.items.map((x) => ({
          ...x,
          createdAt:
            x.createdAt instanceof Date
              ? x.createdAt
              : new Date(String(x.createdAt)),
          updatedAt:
            x.updatedAt instanceof Date
              ? x.updatedAt
              : new Date(String(x.updatedAt)),
        })),
      );
    }
  }, [leadId]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    setProposals(initialProposals);
  }, [initialProposals]);

  useEffect(() => {
    if (!canUpdate || lines.length === 0) return;
    const candidates = lines.filter((li) => {
      const name = li.productName?.trim() ?? "";
      if (!name || name.length < 3) return false;
      if (inFlightLookupRef.current.has(li.id)) return false;
      const normalized = normalizeMaterialName(name);
      const alreadyResolved = resolvedNameByLineRef.current[li.id];
      const needsFill =
        (li.salePrice ?? 0) <= 0 || !li.unit?.trim() || !li.category?.trim();
      return needsFill && alreadyResolved !== normalized;
    });
    if (!candidates.length) return;

    setMaterialLookupBusy(true);
    void Promise.all(
      candidates.slice(0, 6).map(async (li) => {
        const query = li.productName.trim();
        inFlightLookupRef.current.add(li.id);
        try {
          const r = await fetch(
            `/api/materials/search?q=${encodeURIComponent(query)}&limit=8`,
          );
          const j = await parseResponseJson<{ items?: MaterialSearchHit[] }>(r);
          if (!r.ok) return;
          const best = pickBestMaterialHit(query, j.items ?? []);
          if (!best) return;

          setLines((prev) =>
            prev.map((x) => {
              if (x.id !== li.id) return x;
              const patch: Partial<EstimateLineDraft> = {};
              if ((x.salePrice ?? 0) <= 0 && typeof best.unitPrice === "number") {
                patch.salePrice = best.unitPrice;
              }
              if (!x.unit?.trim() && best.unit?.trim()) {
                patch.unit = best.unit.trim();
              }
              if (!x.category?.trim()) {
                patch.category =
                  best.category?.trim() ||
                  best.brand?.trim() ||
                  best.providerKey?.trim() ||
                  best.supplier?.toUpperCase() ||
                  x.category;
              }
              if (Object.keys(patch).length === 0) return x;
              return recalcLineAmount({ ...x, ...patch });
            }),
          );
          resolvedNameByLineRef.current[li.id] = normalizeMaterialName(query);
        } catch {
          // no-op: auto lookup should not block manual editing
        } finally {
          inFlightLookupRef.current.delete(li.id);
        }
      }),
    ).finally(() => setMaterialLookupBusy(false));
  }, [lines, canUpdate]);

  const createEstimate = async () => {
    if (!canCreate) return;
    setCreateBusy(true);
    setErr(null);
    try {
      const j = await postJson<{
        estimate?: { id: string };
        error?: string;
      }>(`/api/leads/${leadId}/estimates`, {
        estimateName: leadTitle,
        templateKey: KITCHEN_NO_COUNTER_TEMPLATE_KEY,
      });
      if (j.estimate?.id) {
        await refreshList();
        setSelectedId(j.estimate.id);
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setCreateBusy(false);
    }
  };

  const recalcLineAmount = (li: EstimateLineDraft): EstimateLineDraft => {
    const c = li.coefficient ?? 1;
    return {
      ...li,
      amountSale: Math.round(li.qty * c * li.salePrice * 100) / 100,
      amountCost:
        li.costPrice != null && Number.isFinite(li.costPrice)
          ? Math.round(li.qty * li.costPrice * 100) / 100
          : null,
    };
  };

  const updateLine = (id: string, patch: Partial<EstimateLineDraft>) => {
    setLines((prev) =>
      prev.map((li) => {
        if (li.id !== id) return li;
        let next: EstimateLineDraft = { ...li, ...patch };

        // Автопідтяжка ціни з Viyar для відомих ЛДСП/матеріалів за назвою.
        if (typeof patch.productName === "string") {
          const match = lookupViyarPriceByName(patch.productName);
          if (match && patch.salePrice === undefined) {
            next = {
              ...next,
              salePrice: match.unitPrice,
              unit: next.unit?.trim() ? next.unit : match.unit,
            };
          }
        }

        return recalcLineAmount(next);
      }),
    );
  };

  /** Вибір рядка з випадаючого списку прайсу в таблиці кухні */
  const applyKitchenCatalogHit = (
    lineId: string,
    hit: MaterialSearchHit,
  ) => {
    resolvedNameByLineRef.current[lineId] = normalizeMaterialName(hit.label);
    const cat =
      hit.category?.trim() ||
      hit.brand?.trim() ||
      hit.providerKey?.trim() ||
      undefined;
    updateLine(lineId, {
      productName: hit.label,
      ...(typeof hit.unitPrice === "number" ? { salePrice: hit.unitPrice } : {}),
      ...(hit.unit?.trim() ? { unit: hit.unit.trim() } : {}),
      ...(cat ? { category: cat } : {}),
    });
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((li) => li.id !== id));
  };

  const duplicateLine = (li: EstimateLineDraft) => {
    setLines((prev) => {
      const idx = prev.findIndex((x) => x.id === li.id);
      const copy = recalcLineAmount({
        ...li,
        id: uid(),
        metadataJson: undefined,
        furnitureBlockKind: li.furnitureBlockKind,
        tableTitle: li.tableTitle,
        kitchenClientPriceMultiplier: li.kitchenClientPriceMultiplier,
        kitchenMaterialMarkupPercent: li.kitchenMaterialMarkupPercent,
      });
      if (idx < 0) return [...prev, copy];
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
  };

  const lineMatchesBlockPartition = (
    li: EstimateLineDraft,
    blockKind: FurnitureBlockKind | null,
  ) =>
    blockKind != null
      ? li.furnitureBlockKind === blockKind
      : !li.furnitureBlockKind;

  const updatePartitionTableTitle = (
    blockKind: FurnitureBlockKind | null,
    title: string,
    defaultTitle: string,
  ) => {
    if (!canUpdate) return;
    const trimmed = title.trim();
    const clearOverride = !trimmed || trimmed === defaultTitle;
    setLines((prev) =>
      prev.map((li) => {
        if (!lineMatchesBlockPartition(li, blockKind)) return li;
        return {
          ...li,
          tableTitle: clearOverride ? undefined : trimmed.slice(0, 200),
        };
      }),
    );
  };

  const updatePartitionKitchenPricing = (
    blockKind: FurnitureBlockKind | null,
    clientMultiplier: number,
    markupPercent: number,
  ) => {
    if (!canUpdate) return;
    const cmRaw = Number(clientMultiplier);
    const mpRaw = Number(markupPercent);
    const cm =
      Number.isFinite(cmRaw) && cmRaw > 0
        ? Math.min(10, Math.max(0.5, cmRaw))
        : KITCHEN_CLIENT_PRICE_MULTIPLIER;
    const mp =
      Number.isFinite(mpRaw) && mpRaw > 0
        ? Math.min(500, Math.max(1, mpRaw))
        : KITCHEN_MARKUP_PERCENT_LABEL;
    setLines((prev) =>
      prev.map((li) => {
        if (!lineMatchesBlockPartition(li, blockKind)) return li;
        return {
          ...li,
          kitchenClientPriceMultiplier:
            Math.abs(cm - KITCHEN_CLIENT_PRICE_MULTIPLIER) < 1e-9
              ? undefined
              : cm,
          kitchenMaterialMarkupPercent:
            Math.abs(mp - KITCHEN_MARKUP_PERCENT_LABEL) < 1e-9
              ? undefined
              : mp,
        };
      }),
    );
  };

  const addKitchenMaterialRow = (blockKind: FurnitureBlockKind | null) => {
    if (!canUpdate) return;
    const buildRow = (
      groupId: string,
      groupLabel: string,
      groupIcon: string,
      inheritedTitle: string | undefined,
    ): EstimateLineDraft =>
      recalcLineAmount({
        id: uid(),
        type: "PRODUCT",
        category: getTemplateTitle(activeTemplateKey),
        productName: "Нова позиція",
        qty: 1,
        unit: "шт",
        salePrice: 0,
        costPrice: null,
        amountSale: 0,
        amountCost: null,
        coefficient: 1,
        kitchenRole: "material",
        groupId,
        groupLabel,
        groupIcon,
        templateKey: activeTemplateKey,
        ...(blockKind ? { furnitureBlockKind: blockKind } : {}),
        ...(inheritedTitle ? { tableTitle: inheritedTitle } : {}),
      });

    setLines((prev) => {
      const part = prev.filter((li) =>
        lineMatchesBlockPartition(li, blockKind),
      );
      const inherited = part.map((li) => li.tableTitle?.trim()).find(Boolean);
      const inheritedClient = part
        .map((li) => li.kitchenClientPriceMultiplier)
        .find((v) => v != null && Number.isFinite(v));
      const inheritedMarkup = part
        .map((li) => li.kitchenMaterialMarkupPercent)
        .find((v) => v != null && Number.isFinite(v));
      const row = buildRow("custom", "Інше", "📦", inherited);
      return [
        ...prev,
        {
          ...row,
          ...(inheritedClient != null
            ? { kitchenClientPriceMultiplier: inheritedClient }
            : {}),
          ...(inheritedMarkup != null
            ? { kitchenMaterialMarkupPercent: inheritedMarkup }
            : {}),
        },
      ];
    });
  };

  const addFurnitureBlock = (kind: FurnitureBlockKind) => {
    if (!canUpdate) return;
    const meta = FURNITURE_TEMPLATES.find((t) => t.key === kind);
    if (!meta) return;
    const label = nextBlockLabel(meta.label, kind, lines);
    const newRows = seedRowsForFurnitureBlock(kind, {
      blockLabel: label,
      newId: uid,
    });
    setLines((prev) => [...prev, ...newRows.map((r) => recalcLineAmount(r))]);
  };

  const addKitchenMaterialRowToGroup = (
    groupId: string,
    groupLabel: string,
    groupIcon: string,
    blockKind: FurnitureBlockKind | null,
  ) => {
    if (!canUpdate) return;
    setLines((prev) => {
      const inherited = prev
        .filter((li) => lineMatchesBlockPartition(li, blockKind))
        .map((li) => li.tableTitle?.trim())
        .find(Boolean);
      return [
        ...prev,
        recalcLineAmount({
          id: uid(),
          type: "PRODUCT",
          category: getTemplateTitle(activeTemplateKey),
          productName: "Нова позиція",
          qty: 1,
          unit: "шт",
          salePrice: 0,
          costPrice: null,
          amountSale: 0,
          amountCost: null,
          coefficient: 1,
          kitchenRole: "material",
          groupId,
          groupLabel,
          groupIcon,
          templateKey: activeTemplateKey,
          ...(blockKind ? { furnitureBlockKind: blockKind } : {}),
          ...(inherited ? { tableTitle: inherited } : {}),
        }),
      ];
    });
  };


  const runAiAssist = async () => {
    if (!canUpdate || aiBusy) return;
    setAiBusy(true);
    setErr(null);
    try {
      const j = await postJson<{
        draft?: {
          lines: Array<{
            type: LineType;
            category: string | null;
            productName: string;
            qty: number;
            unit: string;
            salePrice: number;
            amountSale: number;
          }>;
          assumptions?: string[];
          missing?: string[];
        };
        error?: string;
      }>(`/api/leads/${leadId}/estimates/ai-assist`, {
        prompt: aiPrompt,
        estimateName: leadTitle,
        lines: lines.map((li) => ({
          type: li.type,
          category: li.category,
          productName: li.productName,
          qty: li.qty,
          unit: li.unit,
          salePrice: li.salePrice,
        })),
      });
      const aiLines = j.draft?.lines ?? [];
      if (!aiLines.length) return;
      setAiHints([...(j.draft?.assumptions ?? []), ...(j.draft?.missing ?? [])]);
      const next = [...lines];
      for (let i = 0; i < Math.min(lines.length, aiLines.length); i++) {
        const d = aiLines[i];
        next[i] = recalcLineAmount({
          ...next[i],
          type: d.type,
          category: d.category,
          productName: d.productName,
          qty: d.qty,
          unit: d.unit,
          salePrice: d.salePrice,
        });
      }
      if (aiLines.length > lines.length) {
        for (let i = lines.length; i < aiLines.length; i++) {
          const d = aiLines[i];
          next.push(
            recalcLineAmount({
              id: uid(),
              type: d.type,
              category: d.category ?? getTemplateTitle(activeTemplateKey),
              productName: d.productName,
              qty: d.qty,
              unit: d.unit,
              salePrice: d.salePrice,
              costPrice: null,
              amountSale: d.amountSale,
              amountCost: null,
              coefficient: 1,
              kitchenRole: "material",
              groupId: "custom",
              groupLabel: "AI пропозиції",
              groupIcon: "🤖",
              templateKey: activeTemplateKey,
              ...(lines[0]?.furnitureBlockKind
                ? { furnitureBlockKind: lines[0].furnitureBlockKind }
                : {}),
            }),
          );
        }
      }
      setLines(next);
      setAiPrompt("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI помилка");
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    if (!selectedId || !canUpdate) return;
    setSaveBusy(true);
    setErr(null);
    try {
      const lineItems = lines.map((li) => ({
        id: li.id.startsWith("t_") ? undefined : li.id,
        type: li.type,
        category: li.category,
        productName: li.productName,
        qty: li.qty,
        unit: li.unit,
        salePrice: li.salePrice,
        costPrice: li.costPrice ?? null,
        amountSale: li.amountSale,
        amountCost: li.amountCost ?? null,
        metadataJson: metadataJsonForSave(li, activeTemplateKey),
      }));
      const j = await patchLeadEstimateById<{
        estimate?: Record<string, unknown>;
        estimateIdChanged?: boolean;
        error?: string;
      }>(leadId, selectedId, {
        versioning: forkOnSave ? "fork" : "inline",
        changeSummary: forkOnSave
          ? "Оновлення з робочого місця (нова версія)"
          : null,
        name: estimate?.name ?? null,
        notes: notes || null,
        discountAmount,
        deliveryCost,
        installationCost,
        status,
        lineItems,
      });
      if (j.estimateIdChanged && j.estimate && typeof j.estimate === "object") {
        const ne = j.estimate as { id?: string };
        if (ne.id) {
          setSelectedId(ne.id);
        }
      }
      await refreshList();
      router.refresh();
      if (j.estimate && typeof j.estimate.id === "string") {
        await loadEstimate(String(j.estimate.id));
      } else if (selectedId) {
        await loadEstimate(selectedId);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setSaveBusy(false);
    }
  };

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!canUpdate || saveBusy || !estimate) return;
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUpdate, saveBusy, estimate]);

  const setAsCurrent = async () => {
    if (!selectedId || !canUpdate) return;
    setSaveBusy(true);
    setErr(null);
    try {
      await patchLeadEstimateById<{ error?: string }>(leadId, selectedId, {
        setCurrent: true,
      });
      await refreshList();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setSaveBusy(false);
    }
  };

  const proposalsForSelected = useMemo(
    () =>
      selectedId
        ? proposals.filter((p) => p.estimateId === selectedId)
        : [],
    [proposals, selectedId],
  );
  const activeTemplateKey = useMemo<FurnitureTemplateKey>(() => {
    if (estimate?.templateKey) {
      return detectTemplateKeyByEstimateName(estimate.templateKey);
    }
    return detectTemplateKeyByEstimateName(leadTitle);
  }, [estimate?.templateKey, leadTitle]);

  /**
   * KPI зверху = та сама логіка, що й сума таблиць + знижка / доставка / монтаж
   * (після збереження збігається з полями смети в БД).
   */
  const livePricingTotals = useMemo(() => {
    if (!estimate) {
      return {
        totalPrice: null as number | null,
        totalCost: null as number | null,
      };
    }
    if (lines.length === 0) {
      return {
        totalPrice: estimate.totalPrice,
        totalCost: estimate.totalCost,
      };
    }
    const lineLikes = lines.map((li) => ({
      amountSale: li.amountSale,
      amountCost: li.amountCost ?? null,
      metadataJson: metadataJsonForSave(li, activeTemplateKey),
    }));
    return recalculateEstimateTotals(
      lineLikes,
      discountAmount,
      deliveryCost,
      installationCost,
    );
  }, [
    estimate,
    lines,
    activeTemplateKey,
    discountAmount,
    deliveryCost,
    installationCost,
  ]);

  /** Окрема розрахункова таблиця на кожен тип меблевого блоку. */
  const estimateLineTablePartitions = useMemo(() => {
    const p = partitionLinesByBlockKind(lines);
    if (p.length === 0) {
      return [
        {
          blockKind: null as FurnitureBlockKind | null,
          lines: [] as EstimateLineDraft[],
        },
      ];
    }
    return p;
  }, [lines]);

  /** Живі метрики для стрічки під KPI */
  const liveLineStats = useMemo(() => {
    const total = lines.length;
    const named = lines.filter((l) => l.productName.trim()).length;
    const priced = lines.filter(
      (l) => l.productName.trim() && (l.salePrice ?? 0) > 0,
    ).length;
    const tables = estimateLineTablePartitions.filter(
      (p) => p.lines.length > 0,
    ).length;
    return { total, named, priced, tables };
  }, [lines, estimateLineTablePartitions]);

  /** Контекстні підказки без запиту до сервера */
  const smartContextHints = useMemo(() => {
    const hints: string[] = [];
    if (!estimate) return hints;
    if (lines.length === 0) {
      hints.push(
        "Додайте блок меблів або рядок — з’явиться розрахунок; можна одразу скористатися AI нижче.",
      );
      return hints;
    }
    const noPrice = lines.filter(
      (l) => l.productName.trim() && (l.salePrice ?? 0) <= 0,
    ).length;
    if (noPrice > 0) {
      hints.push(
        `${noPrice} ${noPrice === 1 ? "позиція без ціни" : "позицій без ціни"} — використайте пошук прайсу або кнопку «Застосувати AI до смети».`,
      );
    }
    const zeroQty = lines.filter(
      (l) => l.productName.trim() && (l.qty ?? 0) <= 0,
    ).length;
    if (zeroQty > 0) {
      hints.push(
        `У ${zeroQty} ${zeroQty === 1 ? "рядку" : "рядках"} перевірте кількість (зараз 0 або порожньо).`,
      );
    }
    const tables = estimateLineTablePartitions.filter(
      (p) => p.lines.length > 0,
    ).length;
    if (tables > 1) {
      hints.push(
        `Активних таблиць: ${tables} — підсумки рахуються окремо по кожному блоці.`,
      );
    }
    return hints;
  }, [estimate, lines, estimateLineTablePartitions]);

  const canRunAiAssist = useMemo(
    () =>
      canUpdate &&
      (lines.length > 0 || aiPrompt.trim().length > 0),
    [canUpdate, lines.length, aiPrompt],
  );

  const proposalSummaryHint = useMemo(() => {
    if (!estimate) return "";
    const bits: string[] = [];
    const t = formatUahCompact(
      livePricingTotals.totalPrice ?? estimate.totalPrice,
    );
    if (t) bits.push(`Підсумок розрахунку: ${t}.`);
    const sample = lines
      .filter((l) => l.productName.trim())
      .slice(0, 15)
      .map((l) => `${l.productName.trim()} (${l.qty} ${l.unit})`);
    if (sample.length) {
      bits.push(`Позиції: ${sample.join("; ")}.`);
    }
    return bits.join("\n");
  }, [estimate, lines, livePricingTotals.totalPrice]);

  const proposalDefaultTitle = useMemo(() => {
    if (!estimate) return "КП";
    const name = estimate.name?.trim();
    return name ? `${name} · КП v${estimate.version}` : `КП v${estimate.version}`;
  }, [estimate]);

  const proposalDefaultSummary = useMemo(() => {
    if (!estimate) return "";
    const name = estimate.name?.trim() || leadTitle;
    return `Об'єкт: ${name}. Матеріали, фурнітура та послуги — згідно з розрахунком у таблиці; деталі можна уточнити у менеджера.`;
  }, [estimate, leadTitle]);

  const kpVisualizationRows = useMemo(() => {
    if (!estimate) return [];
    const lineLikes = lines.map((li) => ({
      id: li.id,
      type: li.type,
      category: li.category,
      productName: li.productName,
      qty: li.qty,
      unit: li.unit,
      salePrice: li.salePrice,
      amountSale: li.amountSale,
      metadataJson: metadataJsonForSave(li, activeTemplateKey),
    }));
    return estimateLinesToQuoteItems(lineLikes, {
      estimateName: estimate.name,
      estimateTemplateKey: estimate.templateKey,
    }).map((it) => ({ title: it.title }));
  }, [estimate, lines, activeTemplateKey]);

  const mainSpacingClass = useMemo(() => {
    if (viewMode === "compact") return "space-y-2.5";
    if (viewMode === "pro") return "space-y-6";
    return "space-y-4";
  }, [viewMode]);

  const generateProposalPdf = async (proposalId: string) => {
    if (!canCreate) return;
    setPdfBusyId(proposalId);
    setErr(null);
    try {
      const j = await postJson<{
        pdfUrl?: string;
        publicToken?: string;
        error?: string;
      }>(
        `/api/leads/${leadId}/proposals/${proposalId}/pdf`,
        {},
      );
      const pdfFileUrl =
        typeof j.pdfUrl === "string" && j.pdfUrl.trim() ? j.pdfUrl.trim() : null;
      setProposals((prev) =>
        prev.map((pr) =>
          pr.id === proposalId
            ? {
                ...pr,
                hasPdf: true,
                publicToken: j.publicToken ?? pr.publicToken,
                pdfFileUrl: pdfFileUrl ?? pr.pdfFileUrl,
              }
            : pr,
        ),
      );
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setPdfBusyId(null);
    }
  };

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Немає доступу до прорахунків (потрібен дозвіл перегляду смет).
      </div>
    );
  }

  if (leadConverted) {
    return (
      <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] px-4 py-3 text-sm text-slate-700 shadow-sm">
        <p className="font-medium text-[var(--enver-text)]">
          Лід конвертовано в угоду
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Актуальну смету, КП і договір ведіть у робочому місці угоди — там же
          підпис і передача у виробництво.
        </p>
        {leadDealId ? (
          <Link
            href={`/deals/${leadDealId}/workspace`}
            className="mt-2 inline-flex text-sm font-medium text-sky-700 underline hover:text-sky-900"
          >
            Відкрити угоду
          </Link>
        ) : null}
      </div>
    );
  }

  if (!estimates.length) {
    return (
      <div className={cn(mainSpacingClass)}>
        <div
          className={cn(
            "rounded-xl border bg-[var(--enver-card)] p-3 shadow-sm",
            rolePreset === "technologist"
              ? "border-emerald-200"
              : "border-slate-200",
          )}
        >
          <p className="text-[11px] font-medium text-slate-600">
            Налаштування робочого місця
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
              Вигляд
              <select
                value={viewMode}
                onChange={(e) =>
                  setViewMode(e.target.value as PricingViewMode)
                }
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
              >
                <option value="compact">Компактний</option>
                <option value="standard">Стандартний</option>
                <option value="pro">Pro</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
              Профіль
              <select
                value={rolePreset}
                onChange={(e) =>
                  setRolePreset(e.target.value as PricingRolePreset)
                }
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
              >
                <option value="manager">Менеджер</option>
                <option value="technologist">Технолог</option>
              </select>
            </label>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Ще немає розрахунку для «{leadTitle}». Буде створено таблицю «Кухня без
          стільниці» (як у Excel-КП): кількість, коефіцієнт, ціна, сума та
          підсумки з націнкою.
        </p>
        {canCreate ? (
          <button
            type="button"
            onClick={() => void createEstimate()}
            disabled={createBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {createBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Створити розрахунок
          </button>
        ) : (
          <p className="text-xs text-slate-500">Недостатньо прав на створення.</p>
        )}
        {err ? (
          <p className="text-sm text-rose-600">{err}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn(mainSpacingClass)}>
      {selectedId && estimate && canCreate ? (
        <CreateProposalModal
          open={proposalModalOpen}
          onClose={() => setProposalModalOpen(false)}
          leadId={leadId}
          estimateId={selectedId}
          estimateVersion={estimate.version}
          totalPrice={estimate.totalPrice}
          defaultTitle={proposalDefaultTitle}
          summaryHint={proposalSummaryHint}
          defaultSummary={proposalDefaultSummary}
          kpVisualizationRows={kpVisualizationRows}
          leadImageUrls={leadImageUrlsForKp}
        />
      ) : null}

      <div
        className={cn(
          "rounded-2xl border px-4 py-3 shadow-sm",
          rolePreset === "technologist"
            ? "border-emerald-200/90 bg-gradient-to-r from-white to-emerald-50/50"
            : "border-slate-200/90 bg-gradient-to-r from-white to-slate-50/70",
        )}
      >
        <h2
          className={cn(
            "font-semibold tracking-tight text-[var(--enver-text)]",
            viewMode === "pro" ? "text-base" : "text-sm",
          )}
        >
          Розрахунок вартості
        </h2>
        <p className="mt-1 text-[12px] text-slate-600">
          Прорахунок по блоках, пошук прайсу, AI-підказки та версії смети — у
          одному екрані з живими підсумками.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
            Вигляд
            <select
              value={viewMode}
              onChange={(e) =>
                setViewMode(e.target.value as PricingViewMode)
              }
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
            >
              <option value="compact">Компактний</option>
              <option value="standard">Стандартний</option>
              <option value="pro">Pro</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
            Профіль
            <select
              value={rolePreset}
              onChange={(e) =>
                setRolePreset(e.target.value as PricingRolePreset)
              }
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
            >
              <option value="manager">Менеджер (комерція)</option>
              <option value="technologist">Технолог (собівартість)</option>
            </select>
          </label>
        </div>
        {estimates.length > 0 ? (
          <nav
            className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-500"
            aria-label="Швидкі переходи по розрахунку"
          >
            <a
              href="#lead-pricing-estimate-anchor"
              className="underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
            >
              Версії
            </a>
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <a
              href="#lead-pricing-kp-anchor"
              className="underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
            >
              КП
            </a>
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <a
              href="#lead-pricing-kpi-anchor"
              className="underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
            >
              Підсумки
            </a>
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <a
              href="#lead-pricing-blocks-anchor"
              className="underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
            >
              Блоки
            </a>
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <a
              href="#lead-pricing-ai-anchor"
              className="underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
            >
              AI
            </a>
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <a
              href="#lead-pricing-adjustments-anchor"
              className="underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
            >
              Умови
            </a>
          </nav>
        ) : null}
      </div>

      <div className="lg:flex lg:items-start lg:gap-6">
        <div className={cn("min-w-0 flex-1", mainSpacingClass)}>
      <div
        id="lead-pricing-estimate-anchor"
        className={cn(
          "flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-[var(--enver-card)] px-3 py-3 shadow-sm",
          viewMode === "pro" && "px-4 py-4",
        )}
      >
        <label className="block text-xs">
          <span className="text-slate-500">Версія смети</span>
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value || null)}
            className="mt-1 block w-full min-w-[14rem] rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2 py-1.5 text-sm"
          >
            {estimates.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name?.trim() ? `${e.name.trim()} · ` : ""}
                v{e.version} ·{" "}
                {e.totalPrice != null ? formatUah(e.totalPrice) : "—"} ·{" "}
                {e.status}
                {e.id === activeEstimateId ? " · поточна" : ""}
              </option>
            ))}
          </select>
        </label>
        {canCreate ? (
          <button
            type="button"
            onClick={() => void createEstimate()}
            disabled={createBusy}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-[var(--enver-hover)] disabled:opacity-50"
          >
            {createBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Нова версія
          </button>
        ) : null}
        {canUpdate && selectedId ? (
          <button
            type="button"
            onClick={() => void setAsCurrent()}
            disabled={saveBusy || activeEstimateId === selectedId}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
          >
            {activeEstimateId === selectedId
              ? "Вже поточна для ліда"
              : "Зробити поточною для ліда"}
          </button>
        ) : null}
      </div>

      {selectedId ? (
        <div
          id="lead-pricing-kp-anchor"
          className={cn(
            "scroll-mt-28 rounded-xl border px-4 py-3 text-sm",
            rolePreset === "technologist"
              ? "border-emerald-200 bg-emerald-50/60 text-emerald-950"
              : "border-sky-200 bg-sky-50/60 text-sky-950",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <FileText
              className={cn(
                "h-4 w-4 shrink-0",
                rolePreset === "technologist"
                  ? "text-emerald-700"
                  : "text-sky-700",
              )}
            />
            <span className="font-semibold">Комерційна пропозиція (КП)</span>
          </div>
          <p
            className={cn(
              "mt-1 text-xs",
              rolePreset === "technologist"
                ? "text-emerald-900/85"
                : "text-sky-900/85",
            )}
          >
            КП зберігає знімок обраної смети. PDF додається до вкладки «Файли»
            ліда; тут можна відкрити його напряму або надіслати клієнту публічне
            посилання.
          </p>
          {canCreate ? (
            <button
              type="button"
              onClick={() => setProposalModalOpen(true)}
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-sky-300 bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-50 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Створити КП з цієї смети
            </button>
          ) : (
            <p className="mt-2 text-xs text-sky-800/80">
              Потрібен дозвіл на створення смет/КП.
            </p>
          )}
          {proposalsForSelected.length > 0 ? (
            <ul className="mt-3 space-y-2 border-t border-sky-200/80 pt-3 text-xs">
              {proposalsForSelected.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1"
                >
                  <span className="font-medium">
                    КП v{p.version}
                    <span className="ml-1 font-normal text-sky-800/90">
                      ({p.status})
                    </span>
                  </span>
                  {p.publicToken ? (
                    <a
                      href={`/p/${p.publicToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-800 underline decoration-sky-300 underline-offset-2 hover:text-sky-950"
                    >
                      Публічний перегляд
                    </a>
                  ) : null}
                  {canCreate ? (
                    <Link
                      href={`/leads/${leadId}/proposals/${p.id}/edit`}
                      className="text-[11px] font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
                    >
                      Редагувати позиції КП
                    </Link>
                  ) : null}
                  {canCreate && !p.hasPdf ? (
                    <button
                      type="button"
                      onClick={() => void generateProposalPdf(p.id)}
                      disabled={pdfBusyId === p.id}
                      className="inline-flex items-center gap-1 rounded border border-sky-300 bg-[var(--enver-card)] px-2 py-0.5 text-[11px] font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-50"
                    >
                      {pdfBusyId === p.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                      PDF
                    </button>
                  ) : null}
                  {p.hasPdf ? (
                    <span className="inline-flex flex-wrap items-center gap-2 text-[11px] text-emerald-800">
                      <span>PDF збережено</span>
                      {p.pdfFileUrl ? (
                        <a
                          href={p.pdfFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-emerald-900 underline decoration-emerald-400 underline-offset-2 hover:text-emerald-950"
                        >
                          Відкрити PDF
                        </a>
                      ) : null}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-sky-800/75">
              Для цієї версії смети ще немає КП.
            </p>
          )}
        </div>
      ) : null}

      {loadBusy && !estimate ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Завантаження…
        </div>
      ) : null}

      {estimate ? (
        <>
          <div
            id="lead-pricing-kpi-anchor"
            className={cn(
              "grid gap-3 rounded-xl border border-slate-200 bg-[var(--enver-card)] px-4 py-3 shadow-sm md:grid-cols-[auto_auto_1fr_auto]",
              rolePreset === "technologist"
                ? "ring-1 ring-emerald-300/45"
                : "ring-1 ring-sky-200/50",
            )}
          >
            <div>
              <p className="text-[10px] font-medium uppercase text-slate-400">
                До оплати (оціночно)
              </p>
              <motion.p
                key={String(
                  livePricingTotals.totalPrice ?? estimate.totalPrice ?? "x",
                )}
                initial={{ opacity: 0.65, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className={cn(
                  "font-semibold tabular-nums text-[var(--enver-text)]",
                  viewMode === "pro" ? "text-xl" : "text-lg",
                )}
              >
                {formatUah(livePricingTotals.totalPrice)}
              </motion.p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase text-slate-400">
                Собівартість
              </p>
              <p className="text-sm font-medium text-slate-700">
                {formatUah(livePricingTotals.totalCost)}
              </p>
            </div>
            <label className="text-xs">
              <span className="text-slate-500">Назва розрахунку</span>
              <input
                type="text"
                value={estimate.name ?? ""}
                onChange={(e) =>
                  setEstimate((prev) =>
                    prev
                      ? { ...prev, name: e.target.value.slice(0, 200) }
                      : prev,
                  )
                }
                disabled={!canUpdate}
                placeholder="Назва розрахунку"
                className="mt-1 block min-w-[16rem] rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
              />
            </label>
            <label className="text-xs">
              <span className="text-slate-500">Статус</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={!canUpdate}
                className="mt-1 block rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <motion.div
            layout
            className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-gradient-to-r from-slate-50 to-sky-50/40 px-3 py-2 text-[10px] text-slate-600 shadow-sm"
          >
            <span className="font-semibold uppercase tracking-wide text-slate-400">
              Живий стан
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 font-medium text-slate-800 shadow-sm ring-1 ring-slate-200/80"
              title="Усі рядки в усіх таблицях"
            >
              <Layers className="h-3 w-3 text-sky-600" aria-hidden />
              Рядків: {liveLineStats.total}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 font-medium text-slate-800 shadow-sm ring-1 ring-slate-200/80"
              title="Заповнена назва позиції"
            >
              З назвою: {liveLineStats.named}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 font-medium text-emerald-900 shadow-sm ring-1 ring-emerald-200/80"
              title="Ціна за одиницю більше 0"
            >
              З ціною: {liveLineStats.priced}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 font-medium text-slate-800 shadow-sm ring-1 ring-slate-200/80"
              title="Окремі таблиці по блоках меблів"
            >
              <LayoutGrid className="h-3 w-3 text-violet-600" aria-hidden />
              Таблиць: {liveLineStats.tables}
            </span>
            {materialLookupBusy ? (
              <span className="inline-flex items-center gap-1 text-sky-700">
                <Loader2 className="h-3 w-3 animate-spin" />
                Прайс…
              </span>
            ) : null}
          </motion.div>

          <div
            id="lead-pricing-blocks-anchor"
            className="scroll-mt-28 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-950">
              <Boxes className="h-4 w-4 text-emerald-700" />
              Типи меблів у цьому розрахунку
            </div>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-emerald-900/90 marker:text-emerald-600">
              <li>
                Натисніть тип блоку нижче (кухня, шафа, ванна…) — з’явиться{" "}
                <strong className="font-semibold text-emerald-950">
                  окрема розрахункова таблиця
                </strong>{" "}
                з власними підсумками; усередині — секції по групах матеріалів.
              </li>
              <li>
                У колонці{" "}
                <strong className="font-semibold text-emerald-950">
                  «Найменування»
                </strong>{" "}
                введіть{" "}
                <strong className="font-semibold text-emerald-950">
                  щонайменше 2 літери
                </strong>
                — відкриється список з каталогу прайсів. Оберіть рядок: підставляться
                назва, ціна та од. виміру (як у підказці над таблицею).
              </li>
              <li>
                Можна не обирати зі списку й ввести назву вручну — тоді за
                можливості ціни доповняться фоново з каталогу.
              </li>
              <li>
                <a
                  href="#lead-pricing-ai-anchor"
                  className="font-medium text-emerald-900 underline decoration-emerald-400/80 underline-offset-2 hover:text-emerald-950"
                >
                  AI-допомога
                </a>
                {" · "}
                <a
                  href="#lead-pricing-tables-anchor"
                  className="font-medium text-emerald-900 underline decoration-emerald-400/80 underline-offset-2 hover:text-emerald-950"
                >
                  таблиці блоків
                </a>
                .
              </li>
            </ul>
            {canUpdate ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {FURNITURE_TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => addFurnitureBlock(t.key)}
                    title={t.description}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/80 bg-[var(--enver-card)] px-2.5 py-1.5 text-[11px] font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-100/80"
                  >
                    <span className="text-base leading-none" aria-hidden>
                      {iconForBlockKind(t.key)}
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-emerald-800/70">
                Потрібні права на редагування, щоб додавати блоки.
              </p>
            )}
          </div>

          <PricingAiHelpPanel
            aiPrompt={aiPrompt}
            onAiPromptChange={setAiPrompt}
            onRun={runAiAssist}
            aiBusy={aiBusy}
            canUpdate={canUpdate}
            canRunAi={canRunAiAssist}
            smartHints={smartContextHints}
            apiHints={aiHints}
            materialLookupBusy={materialLookupBusy}
          />

          <div id="lead-pricing-tables-anchor" className="scroll-mt-28 space-y-6">
            {estimateLineTablePartitions.map(({ blockKind, lines: tableLines }) => {
              const defaultTableTitle = sheetTitleForBlockPartition(
                blockKind,
                activeTemplateKey,
              );
              return (
                <KitchenCostSheetTable
                  key={blockKind ?? "__none__"}
                  sheetTitle={defaultTableTitle}
                  lines={tableLines}
                  density={viewMode}
                  canUpdate={canUpdate}
                  showCostFields={showCostFields}
                  onUpdateLine={updateLine}
                  onRemoveLine={removeLine}
                  onDuplicateLine={duplicateLine}
                  onAddMaterialRow={() => addKitchenMaterialRow(blockKind)}
                  onAddMaterialRowToGroup={(groupId, groupLabel, groupIcon) =>
                    addKitchenMaterialRowToGroup(
                      groupId,
                      groupLabel,
                      groupIcon,
                      blockKind,
                    )
                  }
                  onTableTitleChange={
                    canUpdate
                      ? (title) =>
                          updatePartitionTableTitle(
                            blockKind,
                            title,
                            defaultTableTitle,
                          )
                      : undefined
                  }
                  onCatalogLinePick={applyKitchenCatalogHit}
                  onKitchenPricingChange={
                    canUpdate
                      ? (clientMultiplier, markupPercent) =>
                          updatePartitionKitchenPricing(
                            blockKind,
                            clientMultiplier,
                            markupPercent,
                          )
                      : undefined
                  }
                />
              );
            })}
          </div>
          {materialLookupBusy ? (
            <p className="text-xs text-slate-500">
              Оновлюю ціни та поля з бази матеріалів…
            </p>
          ) : null}

          <div
            id="lead-pricing-adjustments-anchor"
            className="scroll-mt-28 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="text-xs">
              <span className="text-slate-500">Знижка (грн)</span>
              <input
                type="number"
                value={discountAmount}
                onChange={(e) =>
                  setDiscountAmount(Number(e.target.value) || 0)
                }
                disabled={!canUpdate}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
              />
            </label>
            <label className="text-xs">
              <span className="text-slate-500">Доставка (грн)</span>
              <input
                type="number"
                value={deliveryCost}
                onChange={(e) =>
                  setDeliveryCost(Number(e.target.value) || 0)
                }
                disabled={!canUpdate}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
              />
            </label>
            <label className="text-xs">
              <span className="text-slate-500">Монтаж (грн)</span>
              <input
                type="number"
                value={installationCost}
                onChange={(e) =>
                  setInstallationCost(Number(e.target.value) || 0)
                }
                disabled={!canUpdate}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
              />
            </label>
          </div>

          <label className="block rounded-xl border border-slate-200 bg-[var(--enver-card)] p-3 text-xs">
            <span className="text-slate-500">Нотатки до смети</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canUpdate}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </label>

          {canUpdate ? (
            <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
              <div className="flex min-w-0 flex-col gap-0.5">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={forkOnSave}
                    onChange={(e) => setForkOnSave(e.target.checked)}
                    disabled={!canUpdate}
                  />
                  Значні зміни — зберегти як нову версію (форк)
                </label>
                <p className="text-[10px] text-slate-400">
                  Ctrl+S / ⌘S — швидке збереження
                </p>
              </div>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saveBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saveBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Зберегти
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Лише перегляд.</p>
          )}
        </>
      ) : null}

        </div>

        <aside
          className="hidden w-44 shrink-0 lg:block"
          aria-label="Розділи розрахунку"
        >
          <nav className="sticky top-20 space-y-0.5 rounded-xl border border-slate-200 bg-[var(--enver-card)] p-2 text-[11px] shadow-sm">
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Розділи
            </p>
            <a
              href="#lead-pricing-estimate-anchor"
              className="block rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Версії
            </a>
            <a
              href="#lead-pricing-kp-anchor"
              className="block rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              КП
            </a>
            <a
              href="#lead-pricing-kpi-anchor"
              className="block rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Підсумки
            </a>
            <a
              href="#lead-pricing-blocks-anchor"
              className="block rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Блоки
            </a>
            <a
              href="#lead-pricing-tables-anchor"
              className="block rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Таблиці
            </a>
            <a
              href="#lead-pricing-ai-anchor"
              className="block rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              AI
            </a>
            <a
              href="#lead-pricing-adjustments-anchor"
              className="block rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Умови
            </a>
            <p className="mt-2 border-t border-slate-100 px-1 pt-2 text-[10px] leading-snug text-slate-400">
              Ctrl+S / ⌘S — зберегти без пошуку кнопки
            </p>
          </nav>
        </aside>
      </div>

      {err ? <p className="text-sm text-rose-600">{err}</p> : null}
    </div>
  );
}
