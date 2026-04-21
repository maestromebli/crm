import { NextResponse } from "next/server";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { compareEstimateVersions } from "../../../../../../lib/estimates/compare-estimate-versions";
import { prisma } from "../../../../../../lib/prisma";

type Ctx = { params: Promise<{ dealId: string }> };

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
  const { searchParams } = new URL(req.url);
  const fromId = searchParams.get("from")?.trim();
  const toId = searchParams.get("to")?.trim();

  if (!fromId || !toId) {
    return NextResponse.json(
      { error: "Потрібні query-параметри from та to (id смети)" },
      { status: 400 },
    );
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessDealAccess(user, P.ESTIMATES_VIEW, deal);
  if (denied) return denied;

  const [fromEst, toEst] = await Promise.all([
    prisma.estimate.findFirst({
      where: { id: fromId, dealId },
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
      where: { id: toId, dealId },
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
      { error: "Одну з версій смети не знайдено для цієї замовлення" },
      { status: 404 },
    );
  }

  const result = compareEstimateVersions(fromEst, toEst);
  return NextResponse.json(result);
}
