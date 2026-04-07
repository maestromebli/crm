import { NextResponse } from "next/server";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { DEAL_DOCUMENT_TEMPLATES } from "../../../../../lib/deals/document-templates";
import { prisma } from "../../../../../lib/prisma";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
  }
  const denied = await forbidUnlessDealAccess(user, P.CONTRACTS_VIEW, deal);
  if (denied) return denied;

  return NextResponse.json({
    items: DEAL_DOCUMENT_TEMPLATES.map((t) => ({
      key: t.key,
      title: t.title,
      documentType: t.documentType,
      format: t.format,
      description: t.description,
    })),
  });
}

