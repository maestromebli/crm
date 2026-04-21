"use client";

/**
 * Робоче місце «Розрахунок» по ліду: таблиця «Кухня без стільниці», версії, КП.
 * DUPLICATE PRICING - TO BE REFACTORED
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
  Send,
  Sparkles,
} from "lucide-react";
import type {
  LeadEstimateSummary,
  LeadProposalSummary,
} from "../../../features/leads/queries";
import { patchLeadEstimateById } from "../../../features/leads/lead-estimate-api";
import { patchJson, postFormData, postJson } from "../../../lib/api/patch-json";
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
import { estimateLinesToQuoteItems } from "../../../lib/quotes/estimate-to-quote-items";
import { lookupViyarPriceByName } from "../../../lib/estimates/viyar-price-lookup";
import { cn } from "../../../lib/utils";
import type { SupplierItem } from "../../../features/suppliers/core/supplierTypes";
import type { EstimateLineDraft, LineType } from "./estimate-line-draft";
import { CreateProposalModal } from "../lead-estimate/CreateProposalModal";
import { KitchenCostSheetTable } from "./KitchenCostSheetTable";
import { ObjectPhotoDropWindow } from "./ObjectPhotoDropWindow";
import { PricingAiHelpPanel } from "./PricingAiHelpPanel";
import {
  iconForBlockKind,
  nextBlockLabel,
  seedRowsForFurnitureBlock,
} from "./seed-furniture-block";
import {
  buildLiveLineStats,
  buildLivePricingTotals,
} from "./services/live-pricing";

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

type UploadedObjectPhoto = {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
};

const STATUS_OPTIONS = [
  { v: "DRAFT", label: "Чернетка" },
  { v: "SENT", label: "Надіслано" },
  { v: "APPROVED", label: "Погоджено" },
  { v: "REJECTED", label: "Відхилено" },
] as const;

const PRICING_VIEW_KEY = "enver.leadPricing.viewMode";
const PRICING_ROLE_KEY = "enver.leadPricing.rolePreset";
const PRICING_DRAFT_KEY_PREFIX = "enver.leadPricing.localDraft";

export type PricingViewMode = "compact" | "standard" | "pro";
export type PricingRolePreset = "manager" | "technologist";

type PricingLocalDraft = {
  lines: EstimateLineDraft[];
  notes: string;
  discountAmount: number;
  deliveryCost: number;
  installationCost: number;
  status: string;
};

function pricingDraftStorageKey(leadId: string, estimateId: string): string {
  return `${PRICING_DRAFT_KEY_PREFIX}.${leadId}.${estimateId}`;
}

function parsePricingLocalDraft(raw: string | null): PricingLocalDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PricingLocalDraft>;
    if (!parsed || !Array.isArray(parsed.lines)) return null;
    return {
      lines: parsed.lines as EstimateLineDraft[],
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      discountAmount:
        typeof parsed.discountAmount === "number" &&
        Number.isFinite(parsed.discountAmount)
          ? parsed.discountAmount
          : 0,
      deliveryCost:
        typeof parsed.deliveryCost === "number" &&
        Number.isFinite(parsed.deliveryCost)
          ? parsed.deliveryCost
          : 0,
      installationCost:
        typeof parsed.installationCost === "number" &&
        Number.isFinite(parsed.installationCost)
          ? parsed.installationCost
          : 0,
      status: typeof parsed.status === "string" ? parsed.status : "DRAFT",
    };
  } catch {
    return null;
  }
}

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

function pickBestSupplierItem(
  query: string,
  items: SupplierItem[],
): SupplierItem | null {
  if (!items.length) return null;
  const q = normalizeMaterialName(query);
  const exact = items.find((x) => normalizeMaterialName(x.name) === q);
  if (exact) return exact;
  const starts = items.find((x) => normalizeMaterialName(x.name).startsWith(q));
  if (starts) return starts;
  return items[0] ?? null;
}

function parseCategoryToken(
  category: string | null | undefined,
): "cabinets" | "facades" | "countertop" | "fittings" | "delivery" | "installation" | "extras" {
  const c = (category ?? "").toLowerCase().trim();
  if (c.startsWith("cat:")) {
    const key = c.slice(4);
    if (
      key === "cabinets" ||
      key === "facades" ||
      key === "countertop" ||
      key === "fittings" ||
      key === "delivery" ||
      key === "installation" ||
      key === "extras"
    ) {
      return key;
    }
  }
  if (/(доставк|delivery|логіст|рейс)/.test(c)) return "delivery";
  if (/(монтаж|install|збірк)/.test(c)) return "installation";
  if (/(фасад|front|door)/.test(c)) return "facades";
  if (/(стільниц|столеш|counter)/.test(c)) return "countertop";
  if (/(фурнітур|fitting|blum|hettich|петл|напрям)/.test(c)) return "fittings";
  if (/(корпус|модул|дсп|мдф|cabinets)/.test(c)) return "cabinets";
  return "extras";
}

function inferBlockKindFromText(
  text: string,
  fallback: FurnitureBlockKind,
): FurnitureBlockKind {
  const t = text.toLowerCase();
  const score = (re: RegExp) => (re.test(t) ? 1 : 0);
  const scores: Array<[FurnitureBlockKind, number]> = [
    [
      "kitchen_island",
      score(/острів|остров|island/) * 3 +
        score(/кухн|стільниц|фасад|модул|blum|hettich/),
    ],
    [
      "wardrobe",
      score(/шаф|гардероб|купе|wardrobe/) * 3 +
        score(/наповнення|штанг|дзеркал/),
    ],
    [
      "bathroom",
      score(/санвуз|ванн|bathroom|умиваль|пенал/) * 3 +
        score(/вологостій|дзеркал/),
    ],
    ["living", score(/віталь|tv|тумба тв|living/) * 3 + score(/стінк|полиц/)],
    [
      "hallway",
      score(/коридор|передпок|hallway/) * 3 + score(/взут|вішалк|ніш/),
    ],
    ["office", score(/офіс|кабінет|office/) * 3 + score(/стелаж|панел|робоч/)],
    ["children", score(/дитяч|children/) * 3 + score(/ліжк|стіл|безпек/)],
    [
      "kitchen",
      score(/кухн|фасад|стільниц|blum|hettich|модул/) * 2 +
        score(/цоколь|кромк|мийк/),
    ],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  const top = scores[0];
  if (top && top[1] >= 2) return top[0];
  return fallback;
}

function inferBlockKindFromMetadata(rawObj: Record<string, unknown>): FurnitureBlockKind | undefined {
  if (
    typeof rawObj.furnitureBlockKind === "string" &&
    isFurnitureTemplateKey(rawObj.furnitureBlockKind)
  ) {
    return rawObj.furnitureBlockKind;
  }
  if (rawObj.templateKey === KITCHEN_NO_COUNTER_TEMPLATE_KEY) {
    return "kitchen";
  }
  if (typeof rawObj.templateKey === "string" && isFurnitureTemplateKey(rawObj.templateKey)) {
    return rawObj.templateKey;
  }
  return undefined;
}

type CategoryToken = ReturnType<typeof parseCategoryToken>;

function categoryTokenFromLineLike(args: {
  category: string | null | undefined;
  productName: string;
}): CategoryToken {
  return parseCategoryToken(`${args.category ?? ""} ${args.productName}`);
}

function requiredCategoryTokensByBlock(
  block: FurnitureBlockKind,
): CategoryToken[] {
  if (block === "kitchen" || block === "kitchen_island") {
    return [
      "cabinets",
      "facades",
      "fittings",
      "countertop",
      "delivery",
      "installation",
    ];
  }
  return ["cabinets", "fittings", "delivery", "installation"];
}

function groupMetaByCategory(cat: ReturnType<typeof parseCategoryToken>): {
  groupId: string;
  groupLabel: string;
  groupIcon: string;
  kitchenRole: EstimateLineDraft["kitchenRole"];
} {
  if (cat === "cabinets") {
    return {
      groupId: "cabinets",
      groupLabel: "Корпус / модулі",
      groupIcon: "🧱",
      kitchenRole: "material",
    };
  }
  if (cat === "facades") {
    return {
      groupId: "facades",
      groupLabel: "Фасади",
      groupIcon: "🎨",
      kitchenRole: "material",
    };
  }
  if (cat === "countertop") {
    return {
      groupId: "countertop",
      groupLabel: "Стільниця",
      groupIcon: "🪵",
      kitchenRole: "material",
    };
  }
  if (cat === "fittings") {
    return {
      groupId: "fittings",
      groupLabel: "Фурнітура",
      groupIcon: "🔩",
      kitchenRole: "material",
    };
  }
  if (cat === "delivery") {
    return {
      groupId: "delivery",
      groupLabel: "Доставка",
      groupIcon: "🚚",
      kitchenRole: "measurement",
    };
  }
  if (cat === "installation") {
    return {
      groupId: "installation",
      groupLabel: "Монтаж",
      groupIcon: "🛠",
      kitchenRole: "measurement",
    };
  }
  return {
    groupId: "custom",
    groupLabel: "Інше",
    groupIcon: "📦",
    kitchenRole: "material",
  };
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
  const furnitureBlockKind = inferBlockKindFromMetadata(rawObj);
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
    ...(typeof rawObj.supplierItemId === "string" && rawObj.supplierItemId
      ? { supplierItemId: rawObj.supplierItemId }
      : {}),
    ...(typeof rawObj.supplierSource === "string" &&
    (rawObj.supplierSource === "VIYAR" ||
      rawObj.supplierSource === "CSV" ||
      rawObj.supplierSource === "MANUAL")
      ? {
          supplierSource: rawObj.supplierSource as
            | "VIYAR"
            | "CSV"
            | "MANUAL",
        }
      : {}),
    ...(typeof rawObj.supplierCode === "string" && rawObj.supplierCode
      ? { supplierCode: rawObj.supplierCode }
      : {}),
    ...(typeof rawObj.supplierUpdatedAt === "string" && rawObj.supplierUpdatedAt
      ? { supplierUpdatedAt: rawObj.supplierUpdatedAt }
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
    ...(li.supplierItemId ? { supplierItemId: li.supplierItemId } : {}),
    ...(li.supplierSource ? { supplierSource: li.supplierSource } : {}),
    ...(li.supplierCode ? { supplierCode: li.supplierCode } : {}),
    ...(li.supplierUpdatedAt ? { supplierUpdatedAt: li.supplierUpdatedAt } : {}),
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
  const consumed = new Set<string>();
  for (const t of FURNITURE_TEMPLATES) {
    const arr = byKey.get(t.key);
    if (arr?.length) {
      out.push({ blockKind: t.key, lines: arr });
      consumed.add(t.key);
    }
  }
  const rest = byKey.get("__none__");
  if (rest?.length) out.push({ blockKind: null, lines: rest });
  consumed.add("__none__");
  // Захист від втрати таблиць: якщо в даних збережений нестандартний ключ блоку,
  // все одно показуємо його в окремій партиції (а не "губимо" після refresh).
  for (const [rawKey, arr] of byKey.entries()) {
    if (!arr.length || consumed.has(rawKey)) continue;
    out.push({ blockKind: null, lines: arr });
  }
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
  return getTemplateTitle(sheetKey);
}

function furniturePartitionTone(blockKind: FurnitureBlockKind | null): {
  wrap: string;
  badge: string;
  hint: string;
  accent: string;
} {
  if (blockKind === "kitchen" || blockKind === "kitchen_island") {
    return {
      wrap: "border-sky-200/80 bg-sky-50/35",
      badge: "bg-sky-100 text-sky-900 ring-sky-200/80",
      hint: "text-sky-900/80",
      accent: "border-l-sky-400",
    };
  }
  if (blockKind === "wardrobe" || blockKind === "hallway") {
    return {
      wrap: "border-violet-200/80 bg-violet-50/30",
      badge: "bg-violet-100 text-violet-900 ring-violet-200/80",
      hint: "text-violet-900/80",
      accent: "border-l-violet-400",
    };
  }
  if (blockKind === "bathroom") {
    return {
      wrap: "border-cyan-200/80 bg-cyan-50/30",
      badge: "bg-cyan-100 text-cyan-900 ring-cyan-200/80",
      hint: "text-cyan-900/80",
      accent: "border-l-cyan-400",
    };
  }
  if (blockKind === "living" || blockKind === "office" || blockKind === "children") {
    return {
      wrap: "border-emerald-200/80 bg-emerald-50/30",
      badge: "bg-emerald-100 text-emerald-900 ring-emerald-200/80",
      hint: "text-emerald-900/80",
      accent: "border-l-emerald-400",
    };
  }
  return {
    wrap: "border-slate-400/80 bg-gradient-to-br from-slate-100 via-slate-50 to-white",
    badge: "bg-slate-900 text-white ring-slate-700/60 shadow-sm",
    hint: "text-slate-800",
    accent: "border-l-slate-600",
  };
}

const uid = () => `t_${Math.random().toString(36).slice(2, 11)}`;

export type LeadPricingWorkspaceClientProps = {
  leadId: string;
  leadTitle: string;
  /** Лід уже конвертований — смета в замовленні. */
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
  /** Id замовлення після конверсії (посилання з заблокованого розділу). */
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
  const [proposalStatusBusyKey, setProposalStatusBusyKey] = useState<string | null>(
    null,
  );
  const [messengerBusyId, setMessengerBusyId] = useState<string | null>(null);
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
  const [aiFileBusy, setAiFileBusy] = useState(false);
  const [aiHints, setAiHints] = useState<string[]>([]);
  const [aiAutoRunPending, setAiAutoRunPending] = useState(false);
  const [materialLookupBusy, setMaterialLookupBusy] = useState(false);
  const inFlightLookupRef = useRef<Set<string>>(new Set());
  const resolvedNameByLineRef = useRef<Record<string, string>>({});
  const [supplierPriceAlerts, setSupplierPriceAlerts] = useState<
    Record<string, { currentPrice: number; currency: "UAH"; updatedAt: string }>
  >({});
  const [viewMode, setViewMode] = useState<PricingViewMode>("standard");
  const [rolePreset, setRolePreset] = useState<PricingRolePreset>("manager");
  const [createTemplateKey, setCreateTemplateKey] =
    useState<FurnitureTemplateKey>(KITCHEN_NO_COUNTER_TEMPLATE_KEY);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [photoWindowPartitionKey, setPhotoWindowPartitionKey] = useState<
    string | null
  >(null);
  const [tableObjectPhotos, setTableObjectPhotos] = useState<
    Record<string, UploadedObjectPhoto[]>
  >({});
  const [photoUploadBusy, setPhotoUploadBusy] = useState(false);
  const [photoUploadErr, setPhotoUploadErr] = useState<string | null>(null);
  const pricingContentRef = useRef<HTMLDivElement | null>(null);

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
        try {
          const localDraft = parsePricingLocalDraft(
            localStorage.getItem(pricingDraftStorageKey(leadId, estimateId)),
          );
          if (localDraft) {
            setLines(localDraft.lines);
            setNotes(localDraft.notes);
            setDiscountAmount(localDraft.discountAmount);
            setDeliveryCost(localDraft.deliveryCost);
            setInstallationCost(localDraft.installationCost);
            setStatus(localDraft.status);
          }
        } catch {
          // no-op: draft restore is optional
        }
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

  useEffect(() => {
    if (!selectedId || !estimate) return;
    try {
      const payload: PricingLocalDraft = {
        lines,
        notes,
        discountAmount,
        deliveryCost,
        installationCost,
        status,
      };
      localStorage.setItem(
        pricingDraftStorageKey(leadId, selectedId),
        JSON.stringify(payload),
      );
    } catch {
      // no-op
    }
  }, [
    leadId,
    selectedId,
    estimate,
    lines,
    notes,
    discountAmount,
    deliveryCost,
    installationCost,
    status,
  ]);

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
            `/api/suppliers/search?q=${encodeURIComponent(query)}&limit=8`,
          );
          const j = await parseResponseJson<{ items?: SupplierItem[] }>(r);
          if (!r.ok) return;
          const best = pickBestSupplierItem(query, j.items ?? []);
          if (!best) return;

          setLines((prev) =>
            prev.map((x) => {
              if (x.id !== li.id) return x;
              const patch: Partial<EstimateLineDraft> = {};
              if ((x.salePrice ?? 0) <= 0 && typeof best.price === "number") {
                patch.salePrice = best.price;
              }
              if (!x.unit?.trim() && best.unit?.trim()) {
                patch.unit = best.unit.trim();
              }
              if (!x.category?.trim()) {
                patch.category =
                  best.category?.trim() ||
                  best.metadata?.brand?.trim() ||
                  best.supplier ||
                  x.category;
              }
              patch.supplierItemId = best.id;
              patch.supplierSource = best.supplier;
              patch.supplierCode = best.code;
              patch.supplierUpdatedAt = best.updatedAt;
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

  useEffect(() => {
    const supplierLines = lines.filter((x) => x.supplierItemId);
    if (!supplierLines.length) {
      setSupplierPriceAlerts({});
      return;
    }
    const ac = new AbortController();
    const ids = supplierLines
      .map((x) => x.supplierItemId)
      .filter((x): x is string => Boolean(x));
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(
            `/api/suppliers/items/batch?ids=${encodeURIComponent(ids.join(","))}`,
            { signal: ac.signal },
          );
          const j = await parseResponseJson<{ items?: SupplierItem[] }>(r);
          if (!r.ok) return;
          const byId = new Map((j.items ?? []).map((x) => [x.id, x]));
          const alerts: Record<
            string,
            { currentPrice: number; currency: "UAH"; updatedAt: string }
          > = {};
          for (const line of supplierLines) {
            if (!line.supplierItemId) continue;
            const item = byId.get(line.supplierItemId);
            if (!item) continue;
            if (Math.abs((line.salePrice ?? 0) - item.price) > 0.009) {
              alerts[line.id] = {
                currentPrice: item.price,
                currency: item.currency,
                updatedAt: item.updatedAt,
              };
            }
          }
          setSupplierPriceAlerts(alerts);
        } catch {
          // no-op, warnings are supplemental
        }
      })();
    }, 220);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [lines]);

  const createEstimate = async (): Promise<string | null> => {
    if (!canCreate) return;
    setCreateBusy(true);
    setErr(null);
    try {
      const j = await postJson<{
        estimate?: { id: string };
        error?: string;
      }>(`/api/leads/${leadId}/estimates`, {
        estimateName: leadTitle,
        templateKey: createTemplateKey,
      });
      if (j.estimate?.id) {
        await refreshList();
        setSelectedId(j.estimate.id);
        router.refresh();
        return j.estimate.id;
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
      return null;
    } finally {
      setCreateBusy(false);
    }
    return null;
  };

  const createEstimateWithAiFocus = async () => {
    if (!canCreate || createBusy) return;
    setAiPrompt((prev) =>
      prev.trim()
        ? prev
        : `Сформуй стартовий розрахунок для "${leadTitle}" з типовими матеріалами, фурнітурою, доставкою та монтажем.`,
    );
    const createdEstimateId = await createEstimate();
    if (!createdEstimateId) return;
    setAiAutoRunPending(true);
    window.setTimeout(() => {
      document.getElementById("lead-pricing-ai-anchor")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 220);
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

  /** Вибір рядка з випадаючого списку постачальників у таблиці кухні */
  const applySupplierItemToLine = (lineId: string, item: SupplierItem) => {
    resolvedNameByLineRef.current[lineId] = normalizeMaterialName(item.name);
    const token = `${item.category ?? ""} ${item.name}`.toLowerCase();
    const type: LineType = /(фурнітур|blum|hettich|напрям|петл|ручк)/.test(token)
      ? "FITTING"
      : "MATERIAL";
    updateLine(lineId, {
      productName: item.name,
      salePrice: item.price,
      unit: item.unit,
      category: item.category ?? null,
      type,
      coefficient: 1,
      supplierItemId: item.id,
      supplierSource: item.supplier,
      supplierCode: item.code,
      supplierUpdatedAt: item.updatedAt,
    });
  };

  const applySupplierPriceUpdate = (lineId: string, currentPrice: number) => {
    updateLine(lineId, { salePrice: currentPrice });
    setSupplierPriceAlerts((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
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

  const addKitchenManualRow = (blockKind: FurnitureBlockKind | null) => {
    if (!canUpdate) return;
    setLines((prev) => {
      const part = prev.filter((li) => lineMatchesBlockPartition(li, blockKind));
      const inherited = part.map((li) => li.tableTitle?.trim()).find(Boolean);
      return [
        ...prev,
        recalcLineAmount({
          id: uid(),
          type: "PRODUCT",
          category: getTemplateTitle(activeTemplateKey),
          productName: "Ручна позиція",
          qty: 1,
          unit: "послуга",
          salePrice: 0,
          costPrice: null,
          amountSale: 0,
          amountCost: null,
          coefficient: 1,
          kitchenRole: "measurement",
          groupId: "manual",
          groupLabel: "Ручні / послуги",
          groupIcon: "🛠",
          templateKey: activeTemplateKey,
          ...(blockKind ? { furnitureBlockKind: blockKind } : {}),
          ...(inherited ? { tableTitle: inherited } : {}),
        }),
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
      if (lines.length === 0) {
        setLines(mapRecognizedToStructuredLines(aiLines));
        setAiPrompt("");
        return;
      }
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

  const mapRecognizedToStructuredLines = (
    aiLines: Array<{
      type: LineType;
      category: string | null;
      productName: string;
      qty: number;
      unit: string;
      salePrice: number;
      amountSale: number;
    }>,
    opts?: { templateKey?: string | null },
  ): EstimateLineDraft[] => {
    const fallbackFromActive: FurnitureBlockKind = isFurnitureTemplateKey(
      activeTemplateKey,
    )
      ? activeTemplateKey
      : "kitchen";
    const fallbackBlock: FurnitureBlockKind =
      opts?.templateKey && isFurnitureTemplateKey(opts.templateKey)
        ? opts.templateKey
        : fallbackFromActive;
    const titleByBlock = new Map<FurnitureBlockKind, string>();

    const mapped = aiLines.map((d) => {
      const cat = parseCategoryToken(d.category);
      const group = groupMetaByCategory(cat);
      const block = inferBlockKindFromText(
        `${d.productName} ${d.category ?? ""}`,
        fallbackBlock,
      );
      if (!titleByBlock.has(block)) {
        const meta = getFurnitureTemplateMeta(block);
        titleByBlock.set(block, meta?.label ?? getTemplateTitle(activeTemplateKey));
      }
      const tableTitle = titleByBlock.get(block) ?? getTemplateTitle(activeTemplateKey);
      return recalcLineAmount({
        id: uid(),
        type: d.type,
        category: d.category ?? getTemplateTitle(activeTemplateKey),
        productName: d.productName,
        qty: d.qty > 0 ? d.qty : 1,
        unit: d.unit || "шт",
        salePrice: d.salePrice >= 0 ? d.salePrice : 0,
        costPrice: null,
        amountSale: d.amountSale,
        amountCost: null,
        coefficient: 1,
        kitchenRole: group.kitchenRole,
        groupId: group.groupId,
        groupLabel: group.groupLabel,
        groupIcon: group.groupIcon,
        templateKey: activeTemplateKey,
        furnitureBlockKind: block,
        tableTitle,
      });
    });

    const byBlock = new Map<FurnitureBlockKind, EstimateLineDraft[]>();
    for (const row of mapped) {
      const bk = row.furnitureBlockKind ?? fallbackBlock;
      const arr = byBlock.get(bk) ?? [];
      arr.push(row);
      byBlock.set(bk, arr);
    }

    const enriched: EstimateLineDraft[] = [...mapped];
    for (const [block, rows] of byBlock.entries()) {
      const existing = new Set<CategoryToken>(
        rows.map((r) =>
          categoryTokenFromLineLike({
            category: r.category,
            productName: r.productName,
          }),
        ),
      );
      const required = requiredCategoryTokensByBlock(block);
      const missing = required.filter((token) => !existing.has(token));
      if (missing.length === 0) continue;

      const blockMeta = getFurnitureTemplateMeta(block);
      const blockLabel = nextBlockLabel(
        blockMeta?.label ?? getTemplateTitle(activeTemplateKey),
        block,
        [...lines, ...enriched],
      );
      const seeded = seedRowsForFurnitureBlock(block, {
        blockLabel,
        newId: uid,
      });
      const seededByToken = new Map<CategoryToken, EstimateLineDraft[]>();
      for (const row of seeded) {
        const token = categoryTokenFromLineLike({
          category: row.category,
          productName: row.productName,
        });
        const arr = seededByToken.get(token) ?? [];
        arr.push(row);
        seededByToken.set(token, arr);
      }
      for (const token of missing) {
        const candidate = seededByToken.get(token)?.[0];
        if (!candidate) continue;
        enriched.push(recalcLineAmount(candidate));
      }
    }
    return enriched;
  };

  const runAiAssistFromFile = async (file: File) => {
    if (!canUpdate || aiFileBusy) return;
    setAiFileBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const j = await postFormData<{
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
        source?: { fileName?: string; mode?: string };
        templateKey?: string | null;
      }>(`/api/leads/${leadId}/estimates/ai-assist-file`, fd);
      const aiLines = j.draft?.lines ?? [];
      if (!aiLines.length) return;
      setAiHints([
        ...(j.source?.fileName ? [`Файл: ${j.source.fileName}`] : []),
        ...(j.draft?.assumptions ?? []),
        ...(j.draft?.missing ?? []),
      ]);
      const structured = mapRecognizedToStructuredLines(aiLines, {
        templateKey: j.templateKey ?? null,
      });
      // Для імпорту з файлу краще одразу побудувати таблиці з розпізнаних рядків.
      const next = structured;
      setLines(next);
      setAiPrompt((prev) =>
        prev.trim()
          ? prev
          : `Розпізнано з файлу: ${j.source?.fileName ?? file.name}`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка розпізнавання файлу");
    } finally {
      setAiFileBusy(false);
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
      try {
        localStorage.removeItem(pricingDraftStorageKey(leadId, selectedId));
      } catch {
        // no-op
      }
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
    // DUPLICATE PRICING - TO BE REFACTORED
    // Adapter layer keeps legacy lead pricing stable while estimate-core becomes canonical.
    return buildLivePricingTotals({
      estimate,
      lines,
      activeTemplateKey,
      discountAmount,
      deliveryCost,
      installationCost,
      metadataJsonForSave,
    });
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
  const activePhotoWindowTitle = useMemo(() => {
    if (!photoWindowPartitionKey) return "";
    const partition = estimateLineTablePartitions.find(
      ({ blockKind }) => (blockKind ?? "__none__") === photoWindowPartitionKey,
    );
    if (!partition) return "Розрахунок";
    return sheetTitleForBlockPartition(partition.blockKind, activeTemplateKey);
  }, [photoWindowPartitionKey, estimateLineTablePartitions, activeTemplateKey]);
  const activePhotoWindowItems = useMemo(() => {
    if (!photoWindowPartitionKey) return [];
    return tableObjectPhotos[photoWindowPartitionKey] ?? [];
  }, [photoWindowPartitionKey, tableObjectPhotos]);

  /** Живі метрики для стрічки під KPI */
  const liveLineStats = useMemo(
    () => buildLiveLineStats(lines, estimateLineTablePartitions),
    [lines, estimateLineTablePartitions],
  );

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
        `${noPrice} ${noPrice === 1 ? "позиція без ціни" : "позицій без ціни"} — використайте пошук прайсу або кнопку «AI: додати/оновити позиції».`,
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
  const runAiAssistRef = useRef(runAiAssist);
  runAiAssistRef.current = runAiAssist;

  useEffect(() => {
    if (!aiAutoRunPending) return;
    if (!estimate || !selectedId) return;
    if (!canRunAiAssist || aiBusy) return;
    setAiAutoRunPending(false);
    void runAiAssistRef.current();
  }, [
    aiAutoRunPending,
    estimate,
    selectedId,
    canRunAiAssist,
    aiBusy,
  ]);

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

  const updateProposalStatus = async (
    proposalId: string,
    status: "SENT" | "APPROVED",
  ) => {
    if (!canCreate) return;
    const busyKey = `${proposalId}:${status}`;
    setProposalStatusBusyKey(busyKey);
    setErr(null);
    try {
      await patchJson<{ ok?: boolean }>(
        `/api/leads/${leadId}/proposals/${proposalId}`,
        { status },
      );
      setProposals((prev) =>
        prev.map((pr) =>
          pr.id === proposalId
            ? {
                ...pr,
                status,
                ...(status === "SENT" ? { sentAt: new Date() } : {}),
              }
            : pr,
        ),
      );
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не вдалося оновити статус КП");
    } finally {
      setProposalStatusBusyKey(null);
    }
  };

  const sendProposalToMessenger = async (proposal: LeadProposalSummary) => {
    if (!canUpdate || !proposal.publicToken) return;
    setMessengerBusyId(proposal.id);
    setErr(null);
    try {
      const publicUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/p/${proposal.publicToken}`
          : `/p/${proposal.publicToken}`;
      const titlePart =
        estimate?.name?.trim() ||
        proposal.title?.trim() ||
        leadTitle?.trim() ||
        "ваше КП";
      const text = [
        `Надсилаю комерційну пропозицію по "${titlePart}" (v${proposal.version}).`,
        `Публічний перегляд: ${publicUrl}`,
      ].join("\n");

      await postJson<{ error?: string; providerError?: string | null }>(
        `/api/leads/${leadId}/messenger-thread`,
        { text },
      );
      router.refresh();
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Не вдалося відправити КП у месенджер",
      );
    } finally {
      setMessengerBusyId(null);
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
          Лід конвертовано у замовлення
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Актуальну смету, КП і договір ведіть у робочому місці замовлення — там же
          підпис і передача у виробництво.
        </p>
        {leadDealId ? (
          <Link
            href={`/deals/${leadDealId}/workspace`}
            className="mt-2 inline-flex text-sm font-medium text-sky-700 underline hover:text-sky-900"
          >
            Відкрити замовлення
          </Link>
        ) : null}
      </div>
    );
  }

  if (!estimates.length) {
    return (
      <div className={cn(mainSpacingClass)}>
        <p className="text-sm text-slate-600">
          Ще немає розрахунку для «{leadTitle}». Оберіть шаблон меблів перед
          створенням стартової таблиці.
        </p>
        {canCreate ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[16rem] flex-col gap-1 text-xs text-slate-500">
              Шаблон розрахунку
              <select
                value={createTemplateKey}
                onChange={(e) =>
                  setCreateTemplateKey(e.target.value as FurnitureTemplateKey)
                }
                disabled={createBusy}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
              >
                {FURNITURE_TEMPLATES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
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
          </div>
        ) : (
          <p className="text-xs text-slate-500">Недостатньо прав на створення.</p>
        )}
        <div className="rounded-xl border border-violet-200/90 bg-gradient-to-br from-violet-50/95 via-white to-fuchsia-50/50 px-3 py-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-violet-950">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600 text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                AI-допомога з розрахунком
              </p>
              <p className="mt-1 text-xs leading-relaxed text-violet-900/85">
                Можна почати зі стартової смети від AI: система створить розрахунок
                і відкриє AI-панель для уточнень та доповнень.
              </p>
            </div>
            {canCreate ? (
              <button
                type="button"
                onClick={() => void createEstimateWithAiFocus()}
                disabled={createBusy}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100/70 disabled:opacity-50"
              >
                {createBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Старт з AI
              </button>
            ) : null}
          </div>
        </div>
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
          sourceEstimateLines={lines.map((li) => ({
            id: li.id,
            type: li.type,
            category: li.category,
            productName: li.productName,
            qty: li.qty,
            unit: li.unit,
            salePrice: li.salePrice,
            amountSale: li.amountSale,
            metadataJson: metadataJsonForSave(li, activeTemplateKey),
          }))}
          sourceEstimateName={estimate.name}
          sourceEstimateTemplateKey={estimate.templateKey}
        />
      ) : null}

      {estimates.length > 0 ? (
          <nav
            className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-500"
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

      <div className="lg:flex lg:items-start lg:gap-6">
        <div
          ref={pricingContentRef}
          className={cn("relative min-w-0 flex-1", mainSpacingClass)}
        >
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
                {(() => {
                  const optionTotal =
                    e.id === selectedId
                      ? (livePricingTotals.totalPrice ?? estimate?.totalPrice ?? e.totalPrice)
                      : e.totalPrice;
                  return optionTotal != null ? formatUah(optionTotal) : "—";
                })()}{" "}
                ·{" "}
                {e.status}
                {e.id === activeEstimateId ? " · поточна" : ""}
              </option>
            ))}
          </select>
        </label>
        {canCreate ? (
          <>
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
          </>
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
                  {canCreate && p.status !== "SENT" && p.status !== "APPROVED" ? (
                    <button
                      type="button"
                      onClick={() => void updateProposalStatus(p.id, "SENT")}
                      disabled={proposalStatusBusyKey != null}
                      className="inline-flex items-center gap-1 rounded border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-50"
                    >
                      {proposalStatusBusyKey === `${p.id}:SENT`
                        ? "Оновлення…"
                        : "Позначити як надіслано"}
                    </button>
                  ) : null}
                  {canCreate && p.status !== "APPROVED" ? (
                    <button
                      type="button"
                      onClick={() => void updateProposalStatus(p.id, "APPROVED")}
                      disabled={proposalStatusBusyKey != null}
                      className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {proposalStatusBusyKey === `${p.id}:APPROVED`
                        ? "Оновлення…"
                        : "Підтверджено клієнтом"}
                    </button>
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
                  {canUpdate && p.publicToken ? (
                    <button
                      type="button"
                      onClick={() => void sendProposalToMessenger(p)}
                      disabled={messengerBusyId === p.id}
                      className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-[var(--enver-card)] px-2 py-0.5 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {messengerBusyId === p.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      Відправити
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
          <motion.div
            layout
            className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-[var(--enver-surface)] px-3 py-2 text-[10px] text-slate-600"
          >
            <span className="font-semibold uppercase tracking-wide text-slate-400">
              Живий стан
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 font-medium text-slate-800 shadow-sm ring-1 ring-slate-200/80"
            >
              <Layers className="h-3 w-3 text-sky-600" aria-hidden />
              Рядків: {liveLineStats.total}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 font-medium text-slate-800 shadow-sm ring-1 ring-slate-200/80"
            >
              З назвою: {liveLineStats.named}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 font-medium text-emerald-900 shadow-sm ring-1 ring-emerald-200/80"
            >
              З ціною: {liveLineStats.priced}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 font-medium text-slate-800 shadow-sm ring-1 ring-slate-200/80"
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
            className="scroll-mt-28 rounded-xl border border-emerald-200/80 bg-emerald-50/25 p-3"
          >
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-emerald-950">
              <Boxes className="h-3.5 w-3.5 text-emerald-700" />
              Типи меблів у цьому розрахунку
            </div>
            <p className="mt-1 text-[11px] leading-snug text-emerald-900/90">
              Оберіть тип блоку, щоб додати окрему таблицю. Для автодоповнення
              використовуйте{" "}
              <a
                href="#lead-pricing-ai-anchor"
                className="font-medium text-emerald-900 underline decoration-emerald-400/80 underline-offset-2 hover:text-emerald-950"
              >
                AI
              </a>
              .
            </p>
            {canUpdate ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
                {FURNITURE_TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => addFurnitureBlock(t.key)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/80 bg-[var(--enver-card)] px-2 py-1 text-[10px] font-medium text-emerald-950 transition hover:bg-emerald-100/70"
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
            onFileDrop={runAiAssistFromFile}
            fileBusy={aiFileBusy}
          />

          <div id="lead-pricing-tables-anchor" className="scroll-mt-28 space-y-5">
            {estimateLineTablePartitions.length > 1 ? (
              <div className="rounded-xl border border-slate-200/90 bg-[var(--enver-card)] px-3 py-2 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Швидкий перехід по блоках
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {estimateLineTablePartitions.map(({ blockKind }, idx) => {
                    const key = blockKind ?? "__none__";
                    const label = blockKind
                      ? (getFurnitureTemplateMeta(blockKind)?.label ?? `Блок ${idx + 1}`)
                      : "Інші позиції";
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          document.getElementById(`pricing-table-${key}`)?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <span className="text-slate-500">#{idx + 1}</span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {estimateLineTablePartitions.map(
              ({ blockKind, lines: tableLines }, idx) => {
              const defaultTableTitle = sheetTitleForBlockPartition(
                blockKind,
                activeTemplateKey,
              );
              const partitionKey = blockKind ?? "__none__";
              const blockLabel = blockKind
                ? (getFurnitureTemplateMeta(blockKind)?.label ?? defaultTableTitle)
                : "Інші позиції";
              const blockIcon = blockKind ? iconForBlockKind(blockKind) : "📦";
              const tone = furniturePartitionTone(blockKind);
              const blockTotal = tableLines.reduce(
                (sum, li) => sum + (Number.isFinite(li.amountSale) ? li.amountSale : 0),
                0,
              );
              const blockTotalLabel = formatUahCompact(blockTotal) ?? "0 грн";
              const isFallbackPartition = blockKind == null;
              return (
                <section
                  id={`pricing-table-${partitionKey}`}
                  key={partitionKey}
                  className={cn(
                    "scroll-mt-28 space-y-2.5 rounded-2xl border border-l-4 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
                    tone.wrap,
                    tone.accent,
                    isFallbackPartition &&
                      "border-2 border-l-4 border-slate-500/90 shadow-[0_10px_30px_rgba(15,23,42,0.12)]",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                        tone.badge,
                        isFallbackPartition && "px-3 py-1.5 text-xs",
                      )}
                    >
                      <span className="text-sm leading-none" aria-hidden>
                        {blockIcon}
                      </span>
                      <span className="text-slate-500">#{idx + 1}</span>
                      {blockLabel}
                    </span>
                    <span className={cn("text-[11px] font-medium", tone.hint)}>
                      {tableLines.length > 0 ? `${tableLines.length} рядків` : "Порожній блок"} · {blockTotalLabel}
                    </span>
                  </div>
                  <KitchenCostSheetTable
                    sheetTitle={defaultTableTitle}
                    lines={tableLines}
                    density={viewMode}
                    canUpdate={canUpdate}
                    showCostFields={showCostFields}
                    objectPhotoCount={tableObjectPhotos[partitionKey]?.length ?? 0}
                    onOpenObjectPhotoWindow={() =>
                      setPhotoWindowPartitionKey(partitionKey)
                    }
                    onUpdateLine={updateLine}
                    onRemoveLine={removeLine}
                    onDuplicateLine={duplicateLine}
                    onAddMaterialRow={() => addKitchenMaterialRow(blockKind)}
                    onAddManualRow={() => addKitchenManualRow(blockKind)}
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
                    onSupplierItemPick={applySupplierItemToLine}
                    supplierPriceAlerts={supplierPriceAlerts}
                    onApplySupplierPrice={applySupplierPriceUpdate}
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
                </section>
              );
            })}
          </div>
          <ObjectPhotoDropWindow
            open={photoWindowPartitionKey != null}
            containerRef={pricingContentRef}
            title={activePhotoWindowTitle}
            items={activePhotoWindowItems}
            busy={photoUploadBusy}
            error={photoUploadErr}
            onClose={() => setPhotoWindowPartitionKey(null)}
            onAddFiles={async (filesToAdd) => {
              if (!photoWindowPartitionKey || filesToAdd.length === 0) return;
              setPhotoUploadErr(null);
              setPhotoUploadBusy(true);
              const targetKey = photoWindowPartitionKey;
              try {
                const uploaded: UploadedObjectPhoto[] = [];
                for (const file of filesToAdd) {
                  const fd = new FormData();
                  fd.append("file", file);
                  fd.append("category", "OBJECT_PHOTO");
                  const j = await postFormData<{
                    id?: string;
                    fileUrl?: string;
                    fileName?: string;
                    error?: string;
                  }>(`/api/leads/${leadId}/attachments`, fd);
                  if (j.id && j.fileUrl && j.fileName) {
                    uploaded.push({
                      id: j.id,
                      fileUrl: j.fileUrl,
                      fileName: j.fileName,
                      fileSize: file.size,
                    });
                  }
                }
                if (uploaded.length > 0) {
                  setTableObjectPhotos((prev) => ({
                    ...prev,
                    [targetKey]: [...(prev[targetKey] ?? []), ...uploaded],
                  }));
                }
                router.refresh();
              } catch (e) {
                setPhotoUploadErr(
                  e instanceof Error ? e.message : "Помилка завантаження фото",
                );
              } finally {
                setPhotoUploadBusy(false);
              }
            }}
            onReplaceFiles={async (filesToReplace) => {
              if (!photoWindowPartitionKey || filesToReplace.length === 0) return;
              setPhotoUploadErr(null);
              setPhotoUploadBusy(true);
              const targetKey = photoWindowPartitionKey;
              try {
                const uploaded: UploadedObjectPhoto[] = [];
                for (const file of filesToReplace) {
                  const fd = new FormData();
                  fd.append("file", file);
                  fd.append("category", "OBJECT_PHOTO");
                  const j = await postFormData<{
                    id?: string;
                    fileUrl?: string;
                    fileName?: string;
                    error?: string;
                  }>(`/api/leads/${leadId}/attachments`, fd);
                  if (j.id && j.fileUrl && j.fileName) {
                    uploaded.push({
                      id: j.id,
                      fileUrl: j.fileUrl,
                      fileName: j.fileName,
                      fileSize: file.size,
                    });
                  }
                }
                setTableObjectPhotos((prev) => ({
                  ...prev,
                  [targetKey]: uploaded,
                }));
                router.refresh();
              } catch (e) {
                setPhotoUploadErr(
                  e instanceof Error ? e.message : "Помилка заміни фото",
                );
              } finally {
                setPhotoUploadBusy(false);
              }
            }}
            onRemoveFile={(index) => {
              if (!photoWindowPartitionKey) return;
              setTableObjectPhotos((prev) => {
                const current = prev[photoWindowPartitionKey] ?? [];
                return {
                  ...prev,
                  [photoWindowPartitionKey]: current.filter((_, i) => i !== index),
                };
              });
            }}
            onClear={() => {
              if (!photoWindowPartitionKey) return;
              setTableObjectPhotos((prev) => ({
                ...prev,
                [photoWindowPartitionKey]: [],
              }));
            }}
          />
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
            <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm">
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
