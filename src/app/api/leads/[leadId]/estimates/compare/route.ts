import { NextResponse } from "next/server";
import {
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { compareEstimateVersions } from "../../../../../../lib/estimates/compare-estimate-versions";
import {
  prisma,
  prismaCodegenIncludesEstimateLeadId,
} from "../../../../../../lib/prisma";

type Ctx = { params: Promise<{ leadId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  if (!prismaCodegenIncludesEstimateLeadId()) {
    return NextResponse.json(
      { error: "Прорахунки по ліду недоступні" },
      { status: 503 },
    );
  }

  const { leadId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const fromId = searchParams.get("from")?.trim();
  const toId = searchParams.get("to")?.trim();

  if (!fromId || !toId) {
    return NextResponse.json(
      { error: "Потрібні query-параметри from та to (id смети)" },
      { status: 400 },
    );
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerId: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessLeadAccess(user, P.ESTIMATES_VIEW, lead);
  if (denied) return denied;

  const [fromEst, toEst] = await Promise.all([
    prisma.estimate.findFirst({
      where: { id: fromId, leadId },
      select: {
        id: true,
        version: true,
        totalPrice: true,
        createdAt: true,
        lineItems: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            category: true,
            productName: true,
            qty: true,
            salePrice: true,
            amountSale: true,
            metadataJson: true,
          },
        },
      },
    }),
    prisma.estimate.findFirst({
      where: { id: toId, leadId },
      select: {
        id: true,
        version: true,
        totalPrice: true,
        createdAt: true,
        lineItems: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            category: true,
            productName: true,
            qty: true,
            salePrice: true,
            amountSale: true,
            metadataJson: true,
          },
        },
      },
    }),
  ]);

  if (!fromEst || !toEst) {
    return NextResponse.json(
      { error: "Одну з версій смети не знайдено для цього ліда" },
      { status: 404 },
    );
  }

  const result = compareEstimateVersions(fromEst, toEst);
  return NextResponse.json(result);
}
