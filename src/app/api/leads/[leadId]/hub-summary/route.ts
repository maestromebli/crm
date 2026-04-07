import { NextResponse } from "next/server";
import { getLeadById } from "../../../../../features/leads/queries";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { resolveAccessContext } from "../../../../../lib/authz/data-scope";
import { prisma } from "../../../../../lib/prisma";
import { computeLeadHubReadinessFromDetail } from "../../../../../lib/leads/lead-hub-readiness";
import {
  computeLeadReadinessRows,
  deriveConvertReadinessBanner,
  deriveLeadReadinessRecommendation,
} from "../../../../../lib/leads/lead-readiness-rows";
import { deriveLeadSalesHint } from "../../../../../lib/leads/lead-sales-hints";
import {
  deriveCommercialNextActions,
  deriveCommercialWarnings,
} from "../../../../../lib/leads/commercial-summary";

type Ctx = { params: Promise<{ leadId: string }> };

/**
 * Агреговані сигнали готовності для Hub / модалки конвертації / зовнішніх клієнтів.
 * Один запит замість дублювання логіки на клієнті.
 */
export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.LEADS_VIEW);
  if (denied) return denied;

  const { leadId } = await ctx.params;
  const accessCtx = await resolveAccessContext(prisma, user);
  const lead = await getLeadById(leadId, accessCtx);
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }

  const rows = computeLeadReadinessRows(lead);
  const banner = deriveConvertReadinessBanner(lead);
  const recommendation = deriveLeadReadinessRecommendation(rows);
  const hub = computeLeadHubReadinessFromDetail(lead);
  const salesHint = deriveLeadSalesHint(lead);
  const commercialWarnings = deriveCommercialWarnings(lead);
  const commercialNext = deriveCommercialNextActions(lead);

  return NextResponse.json({
    leadId: lead.id,
    updatedAt: lead.updatedAt.toISOString(),
    hubReadiness: {
      level: hub.level,
      headline: hub.headline,
    },
    readinessRows: rows,
    convertBanner: banner,
    recommendation,
    salesHint,
    commercial: {
      warnings: commercialWarnings,
      nextActions: commercialNext,
    },
  });
}
