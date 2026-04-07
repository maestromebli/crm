/**
 * Деталізація рядка смети (матеріали, фурнітура, послуги) — зберігається в EstimateLineItem.metadataJson.
 * Формат сумісний з Excel-прорахунками: кожна підпозиція має кількість, одиниці, закупівлю та продаж.
 */

export const ESTIMATE_LINE_BREAKDOWN_VERSION = 1 as const;

export type BreakdownComponentKind =
  | "material"
  | "hardware"
  | "service"
  | "other";

export const BREAKDOWN_KIND_LABELS: Record<BreakdownComponentKind, string> = {
  material: "Матеріал",
  hardware: "Фурнітура",
  service: "Послуга",
  other: "Інше",
};

export type BreakdownComponent = {
  id: string;
  kind: BreakdownComponentKind;
  name: string;
  qty: number;
  unit: string;
  /** Закупівля за одиницю */
  unitCost: number | null;
  /** Продаж за одиницю */
  unitSale: number | null;
  note?: string;
};

export type EstimateLineBreakdownMeta = {
  v: typeof ESTIMATE_LINE_BREAKDOWN_VERSION;
  components: BreakdownComponent[];
};

function isKind(x: unknown): x is BreakdownComponentKind {
  return (
    x === "material" ||
    x === "hardware" ||
    x === "service" ||
    x === "other"
  );
}

export function parseEstimateLineBreakdown(
  raw: unknown,
): EstimateLineBreakdownMeta | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== ESTIMATE_LINE_BREAKDOWN_VERSION) return null;
  if (!Array.isArray(o.components)) return null;
  const components: BreakdownComponent[] = [];
  for (const c of o.components) {
    if (!c || typeof c !== "object") continue;
    const r = c as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : "";
    if (!id) continue;
    const kind = isKind(r.kind) ? r.kind : "other";
    const name =
      typeof r.name === "string" ? r.name.trim().slice(0, 500) : "";
    const qty =
      typeof r.qty === "number" && Number.isFinite(r.qty) ? r.qty : 0;
    const unit =
      typeof r.unit === "string" && r.unit.trim() ? r.unit.trim() : "шт";
    const unitCost =
      r.unitCost === null || r.unitCost === undefined
        ? null
        : typeof r.unitCost === "number" && Number.isFinite(r.unitCost)
          ? r.unitCost
          : null;
    const unitSale =
      r.unitSale === null || r.unitSale === undefined
        ? null
        : typeof r.unitSale === "number" && Number.isFinite(r.unitSale)
          ? r.unitSale
          : null;
    const note =
      typeof r.note === "string" ? r.note.trim().slice(0, 500) : undefined;
    components.push({
      id,
      kind,
      name: name || "—",
      qty,
      unit,
      unitCost,
      unitSale,
      ...(note ? { note } : {}),
    });
  }
  return { v: ESTIMATE_LINE_BREAKDOWN_VERSION, components };
}

export function emptyBreakdown(): EstimateLineBreakdownMeta {
  return { v: ESTIMATE_LINE_BREAKDOWN_VERSION, components: [] };
}

/** Копія деталізації з новими id підпозицій (дублікат рядка смети). */
export function cloneBreakdownWithNewIds(
  raw: unknown,
  newId: () => string,
): EstimateLineBreakdownMeta | null {
  const meta = parseEstimateLineBreakdown(raw);
  if (!meta || meta.components.length === 0) return null;
  return {
    v: ESTIMATE_LINE_BREAKDOWN_VERSION,
    components: meta.components.map((c) => ({
      ...c,
      id: newId(),
    })),
  };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Суми підпозицій → суми та ціни за одиницю головного рядка (qty — к-сть «позиції» у сметі). */
export function recomputeLineTotalsFromBreakdown(
  lineQty: number,
  meta: EstimateLineBreakdownMeta | null,
): {
  amountSale: number;
  amountCost: number | null;
  salePrice: number;
  costPrice: number | null;
} {
  const qLine = lineQty > 0 ? lineQty : 1;
  if (!meta || meta.components.length === 0) {
    return {
      amountSale: 0,
      amountCost: null,
      salePrice: 0,
      costPrice: null,
    };
  }
  let amountSale = 0;
  let amountCost = 0;
  let hasCost = false;
  for (const c of meta.components) {
    const q = Number.isFinite(c.qty) ? c.qty : 0;
    const us =
      c.unitSale != null && Number.isFinite(c.unitSale) ? c.unitSale : 0;
    amountSale += q * us;
    if (c.unitCost != null && Number.isFinite(c.unitCost)) {
      amountCost += q * c.unitCost;
      hasCost = true;
    }
  }
  return {
    amountSale: roundMoney(amountSale),
    amountCost: hasCost ? roundMoney(amountCost) : null,
    salePrice: roundMoney(amountSale / qLine),
    costPrice: hasCost ? roundMoney(amountCost / qLine) : null,
  };
}

/** Якщо клієнт без COST_VIEW не передав unitCost, зберігаємо з попереднього збереження (за id рядка компонента). */
export function mergeBreakdownCostsFromPrevious(
  incoming: unknown,
  previous: unknown,
): unknown {
  const next = parseEstimateLineBreakdown(incoming);
  const prev = parseEstimateLineBreakdown(previous);
  if (!next) return incoming;
  if (!prev || prev.components.length === 0) return incoming;
  const prevById = new Map(prev.components.map((c) => [c.id, c]));
  return {
    v: ESTIMATE_LINE_BREAKDOWN_VERSION,
    components: next.components.map((c) => {
      const p = prevById.get(c.id);
      const unitCost =
        c.unitCost !== null && c.unitCost !== undefined
          ? c.unitCost
          : p?.unitCost ?? null;
      return { ...c, unitCost };
    }),
  } satisfies EstimateLineBreakdownMeta;
}

/** Приховати закупівельні ціни в деталізації для клієнта без COST_VIEW. */
export function redactBreakdownForClient(
  raw: unknown,
  canCost: boolean,
): unknown {
  if (canCost) return raw;
  const meta = parseEstimateLineBreakdown(raw);
  if (!meta) return raw;
  return {
    v: meta.v,
    components: meta.components.map((c) => ({
      ...c,
      unitCost: null,
    })),
  };
}
