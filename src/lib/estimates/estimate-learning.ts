import type { EstimateLineType } from "@prisma/client";
import { logAiEvent } from "../ai/log-ai-event";
import { prisma } from "../prisma";

type DraftLikeLine = {
  type: EstimateLineType;
  category: string | null;
  productName: string;
  qty: number;
  unit: string;
  salePrice: number;
  amountSale: number;
};

type HistoricalLine = {
  type: EstimateLineType;
  category: string | null;
  productName: string;
  unit: string;
  salePrice: number;
  updatedAt: Date;
};

type LearningResult = {
  lines: DraftLikeLine[];
  notes: string[];
};

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(name: string): string[] {
  return normalizeProductName(name)
    .split(" ")
    .map((x) => x.trim())
    .filter((x) => x.length >= 2);
}

function similarityScore(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = new Set(tokenize(b));
  if (ta.length === 0 || tb.size === 0) return 0;
  const common = ta.reduce((acc, t) => (tb.has(t) ? acc + 1 : acc), 0);
  return common / ta.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const SIGNAL_MAP: Array<{ key: string; needles: string[] }> = [
  { key: "blum", needles: ["blum"] },
  { key: "hettich", needles: ["hettich"] },
  { key: "egger", needles: ["egger"] },
  { key: "kronospan", needles: ["kronospan"] },
  { key: "muller", needles: ["muller"] },
  { key: "gtv", needles: ["gtv"] },
  { key: "hafele", needles: ["hafele", "haefele"] },
  { key: "viyar", needles: ["viyar", "віяр", "вияр"] },
  { key: "dsp", needles: ["дсп", "dsp"] },
  { key: "mdf", needles: ["мдф", "mdf"] },
  { key: "facade", needles: ["фасад", "facade"] },
  { key: "countertop", needles: ["стільниц", "столеш", "countertop"] },
  { key: "fitting", needles: ["фурнітур", "фурнитур", "fitting"] },
];

function extractSignals(text: string): Set<string> {
  const normalized = normalizeProductName(text);
  const out = new Set<string>();
  for (const s of SIGNAL_MAP) {
    if (s.needles.some((n) => normalized.includes(n))) out.add(s.key);
  }
  return out;
}

function daysBetween(a: Date, b: Date): number {
  const diff = Math.max(0, a.getTime() - b.getTime());
  return diff / (1000 * 60 * 60 * 24);
}

function recencyWeight(updatedAt: Date, now: Date): number {
  const days = daysBetween(now, updatedAt);
  // Half-life ~120 days: new data influences stronger.
  return Math.pow(0.5, days / 120);
}

function inferPriceFromHistory(
  target: DraftLikeLine,
  history: HistoricalLine[],
  minScore = 0.55,
): { salePrice: number; confidence: "high" | "medium" } | null {
  const normalizedTarget = normalizeProductName(target.productName);
  if (!normalizedTarget) return null;
  const now = new Date();
  const targetSignals = extractSignals(`${target.productName} ${target.category ?? ""}`);

  const exact = history.filter(
    (h) => normalizeProductName(h.productName) === normalizedTarget && h.salePrice > 0,
  );
  if (exact.length > 0) {
    const weighted = exact.reduce(
      (acc, h) => {
        const w = recencyWeight(h.updatedAt, now);
        return { sum: acc.sum + h.salePrice * w, weight: acc.weight + w };
      },
      { sum: 0, weight: 0 },
    );
    const avg =
      weighted.weight > 0
        ? weighted.sum / weighted.weight
        : exact.reduce((acc, h) => acc + h.salePrice, 0) / exact.length;
    return { salePrice: round2(avg), confidence: "high" };
  }

  let best: HistoricalLine | null = null;
  let bestScore = 0;
  for (const h of history) {
    if (h.salePrice <= 0) continue;
    const score = similarityScore(target.productName, h.productName);
    const categoryBoost =
      target.category &&
      h.category &&
      target.category.trim().toLowerCase() === h.category.trim().toLowerCase()
        ? 0.15
        : 0;
    const candidateSignals = extractSignals(`${h.productName} ${h.category ?? ""}`);
    const signalMatch =
      targetSignals.size > 0
        ? Array.from(targetSignals).filter((s) => candidateSignals.has(s)).length
        : 0;
    const signalBoost = signalMatch > 0 ? Math.min(0.28, signalMatch * 0.12) : 0;
    const freshnessBoost = recencyWeight(h.updatedAt, now) * 0.1;
    const finalScore = score + categoryBoost + signalBoost + freshnessBoost;
    if (finalScore > bestScore) {
      bestScore = finalScore;
      best = h;
    }
  }
  if (!best || bestScore < minScore) return null;
  return { salePrice: round2(best.salePrice), confidence: "medium" };
}

export async function applyHistoricalPricingHints(input: {
  leadId: string;
  lines: DraftLikeLine[];
}): Promise<LearningResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { lines: input.lines, notes: [] };
  }

  try {
    const [leadEstimates, globalLines] = await Promise.all([
      prisma.estimate.findMany({
        where: { leadId: input.leadId },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: {
          lineItems: {
            select: {
              type: true,
              category: true,
              productName: true,
              unit: true,
              salePrice: true,
              updatedAt: true,
            },
            where: {
              salePrice: { gt: 0 },
              productName: { not: "" },
            },
            take: 60,
          },
        },
      }),
      prisma.estimateLineItem.findMany({
        where: {
          salePrice: { gt: 0 },
          productName: { not: "" },
          type: {
            in: ["PRODUCT", "MATERIAL", "FITTING", "WORK", "SERVICE"],
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 800,
        select: {
          type: true,
          category: true,
          productName: true,
          unit: true,
          salePrice: true,
          updatedAt: true,
        },
      }),
    ]);

    const leadHistory = leadEstimates.flatMap((e) => e.lineItems);
    const history = globalLines;
    if (history.length === 0 && leadHistory.length === 0) {
      return { lines: input.lines, notes: [] };
    }

    let changedCount = 0;
    let highConfidence = 0;
    let fromLeadHistory = 0;
    let fromGlobalHistory = 0;
    const nextLines = input.lines.map((line) => {
      if (!line.productName.trim()) return line;
      if (line.salePrice > 0) return line;
      const inferredLeadExact = inferPriceFromHistory(line, leadHistory, 1);
      const inferredLeadFuzzy =
        inferredLeadExact ?? inferPriceFromHistory(line, leadHistory, 0.52);
      const inferredGlobalExact = inferPriceFromHistory(line, history, 1);
      const inferredGlobalFuzzy =
        inferredGlobalExact ?? inferPriceFromHistory(line, history, 0.62);
      const inferred =
        inferredLeadExact ??
        inferredLeadFuzzy ??
        inferredGlobalExact ??
        inferredGlobalFuzzy;
      if (!inferred) return line;
      changedCount += 1;
      if (inferred.confidence === "high") highConfidence += 1;
      if (inferredLeadExact || inferredLeadFuzzy) {
        fromLeadHistory += 1;
      } else {
        fromGlobalHistory += 1;
      }
      const nextSale = inferred.salePrice;
      return {
        ...line,
        salePrice: nextSale,
        amountSale: round2((line.qty || 0) * nextSale),
      };
    });

    const notes: string[] = [];
    notes.push(
      `Враховано попередні меблеві розрахунки: локально ${leadHistory.length}, глобально ${history.length} позицій.`,
    );
    if (changedCount > 0) {
      notes.push(
        `Автопiдстановка цiн: ${changedCount} позицій (${highConfidence} точних збігів; локальних ${fromLeadHistory}, глобальних ${fromGlobalHistory}).`,
      );
    }
    notes.push("Пріоритет: свіжі дані + збіг бренду/постачальника.");

    return { lines: nextLines, notes };
  } catch (e) {
    console.error("[applyHistoricalPricingHints]", e);
    return { lines: input.lines, notes: [] };
  }
}

export async function recordEstimateLearningSnapshot(input: {
  userId: string;
  leadId?: string | null;
  dealId?: string | null;
  estimateId: string;
  lineItems: Array<{
    productName: string;
    salePrice: number;
    qty: number;
    amountSale: number;
  }>;
  totalPrice: number | null | undefined;
}): Promise<void> {
  const entityType = input.leadId ? "LEAD_ESTIMATE" : "DEAL_ESTIMATE";
  const entityId = input.leadId ?? input.dealId ?? null;
  const pricedLines = input.lineItems.filter((x) => x.salePrice > 0).length;
  const avgPrice =
    pricedLines > 0
      ? round2(
          input.lineItems.reduce((acc, x) => acc + (x.salePrice > 0 ? x.salePrice : 0), 0) /
            pricedLines,
        )
      : 0;

  await logAiEvent({
    userId: input.userId,
    action: "estimate_learning_snapshot",
    entityType,
    entityId,
    ok: true,
    metadata: {
      estimateId: input.estimateId,
      leadId: input.leadId ?? null,
      dealId: input.dealId ?? null,
      lineCount: input.lineItems.length,
      pricedLineCount: pricedLines,
      avgSalePrice: avgPrice,
      totalPrice: input.totalPrice ?? null,
      capturedAt: new Date().toISOString(),
    },
  });
}
