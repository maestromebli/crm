import { NextResponse } from "next/server";
import {
  forbidUnlessLeadAccess,
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { parseEstimatePromptToDraft, type DraftLine } from "../../../../../../lib/estimates/ai-estimate-draft";
import { enrichDraftPricingFromText } from "../../../../../../lib/estimates/estimate-draft-pricing-enrich";
import type { EstimateCategoryKey } from "../../../../../../lib/estimates/estimate-categories";
import { applyHistoricalPricingHints } from "../../../../../../lib/estimates/estimate-learning";
import { recordContinuousLearningEvent } from "../../../../../../lib/ai/continuous-learning";
import { prisma } from "../../../../../../lib/prisma";
import { buildSupplierAiHints } from "../../../../../../features/suppliers/services/supplierSearchService";

type Ctx = { params: Promise<{ leadId: string }> };

function inferCategoryKey(productName: string, type: string): EstimateCategoryKey {
  const t = productName.toLowerCase();
  if (type === "DELIVERY") return "delivery";
  if (type === "INSTALLATION") return "installation";
  if (/фасад|door|front|ручк|gola/.test(t)) return "facades";
  if (/blum|hettich|петл|напрям|фурнітур|фурнитур/.test(t)) return "fittings";
  if (/стільниц|столеш|counter/.test(t)) return "countertop";
  if (/доставка|логіст|transport/.test(t)) return "delivery";
  if (/монтаж|збірк|install/.test(t)) return "installation";
  if (/дсп|мдф|корпус|шаф|тумб|модул|полиц/.test(t)) return "cabinets";
  return "extras";
}

function toDraftLine(raw: Record<string, unknown>): DraftLine | null {
  const productName = typeof raw.productName === "string" ? raw.productName.trim() : "";
  if (!productName) return null;
  const qty = typeof raw.qty === "number" && Number.isFinite(raw.qty) ? raw.qty : 1;
  const salePrice =
    typeof raw.salePrice === "number" && Number.isFinite(raw.salePrice) ? raw.salePrice : 0;
  const unit = typeof raw.unit === "string" && raw.unit.trim() ? raw.unit : "шт";
  const type = typeof raw.type === "string" ? raw.type : "PRODUCT";
  const category = typeof raw.category === "string" && raw.category.trim() ? raw.category : null;
  return {
    type: (type as DraftLine["type"]) ?? "PRODUCT",
    category,
    categoryKey: inferCategoryKey(productName, type),
    productName,
    qty,
    unit,
    salePrice,
    amountSale: Math.round(qty * salePrice * 100) / 100,
  };
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const estDenied = forbidUnlessPermission(user, P.ESTIMATES_CREATE);
  if (estDenied) return estDenied;

  const { leadId } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerId: true, dealId: true, title: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }
  if (lead.dealId) {
    return NextResponse.json({ error: "Використовуйте смету в угоді" }, { status: 409 });
  }

  const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
  if (denied) return denied;

  let body: {
    prompt?: string;
    estimateName?: string;
    lines?: Array<Record<string, unknown>>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const estimateName =
    typeof body.estimateName === "string" && body.estimateName.trim()
      ? body.estimateName.trim()
      : lead.title;

  const baseLines = Array.isArray(body.lines)
    ? body.lines.map(toDraftLine).filter((x): x is DraftLine => Boolean(x))
    : [];

  const parsed = parseEstimatePromptToDraft(prompt);

  const seen = new Set(baseLines.map((l) => normalizeName(l.productName)));
  const merged: DraftLine[] = [...baseLines];
  for (const p of parsed.lines) {
    const key = normalizeName(p.productName);
    if (!seen.has(key)) {
      merged.push(p);
      seen.add(key);
    }
  }

  const contextText = [estimateName, prompt].filter(Boolean).join("\n\n");
  const { lines, extraAssumptions } = enrichDraftPricingFromText(merged, contextText);
  const learned = await applyHistoricalPricingHints({
    leadId,
    lines,
  });
  const supplierHints = await buildSupplierAiHints(prompt);

  const finalAssumptions = [
    ...parsed.assumptions,
    ...extraAssumptions,
    ...learned.notes,
    ...supplierHints,
  ];
  await recordContinuousLearningEvent({
    userId: user.id,
    action: "estimate_ai_assist",
    stage: "estimate_assist",
    entityType: "LEAD",
    entityId: leadId,
    ok: true,
    metadata: {
      promptLength: prompt.length,
      baseLines: baseLines.length,
      resultLines: learned.lines.length,
      assumptions: finalAssumptions.length,
      missing: parsed.missing.length,
      learnedFromHistory: learned.notes.length > 0,
    },
  });

  return NextResponse.json({
    ok: true,
    draft: {
      lines: learned.lines,
      assumptions: finalAssumptions,
      missing: parsed.missing,
    },
  });
}
