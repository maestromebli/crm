import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { evaluateReadiness, allReadinessMet } from "@/lib/deal-core/readiness";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";
import { buildDealStageInsight } from "../../../../../lib/ai-workflow/stage-insights";
import type { DealStageAiId } from "../../../../../lib/ai-workflow/types";

type Ctx = { params: Promise<{ dealId: string }> };

function parseMeta(raw: unknown): DealWorkspaceMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DealWorkspaceMeta;
}

function parseStage(v: string | null): DealStageAiId | null {
  if (
    v === "qualification" ||
    v === "measurement" ||
    v === "proposal" ||
    v === "contract" ||
    v === "payment" ||
    v === "handoff" ||
    v === "production"
  ) {
    return v;
  }
  return null;
}

export async function GET(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { dealId } = await ctx.params;

  const url = new URL(req.url);
  const stage = parseStage(url.searchParams.get("stage"));
  if (!stage) {
    return NextResponse.json({ error: "Некоректний stage" }, { status: 400 });
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      contract: { select: { status: true } },
      handoff: { select: { status: true } },
      productionFlow: { select: { status: true } },
      _count: { select: { estimates: true } },
    },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, {
    ownerId: deal.ownerId,
  });
  if (denied) return denied;

  const attachments = await prisma.attachment.findMany({
    where: { entityType: "DEAL", entityId: deal.id },
    select: { category: true },
  });
  const attachmentsByCategory: Record<string, number> = {};
  for (const a of attachments) {
    attachmentsByCategory[a.category] = (attachmentsByCategory[a.category] ?? 0) + 1;
  }
  const meta = parseMeta(deal.workspaceMeta);
  const readiness = evaluateReadiness({
    meta,
    contractStatus: deal.contract?.status ?? null,
    attachmentsByCategory,
  });
  const insight = buildDealStageInsight({
    stage,
    meta,
    readinessAllMet: allReadinessMet(readiness),
    handoffStatus: deal.handoff?.status ?? "DRAFT",
    productionLaunchStatus: deal.productionFlow ? "LAUNCHED" : "NOT_READY",
    contractStatus: deal.contract?.status ?? null,
    attachmentsByCategory,
    estimatesCount: deal._count.estimates,
  });

  return NextResponse.json({ insight });
}
