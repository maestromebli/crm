import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { computeDealFinanceRollup } from "../../../../../../lib/finance/deal-finance-rollup";

type Ctx = { params: Promise<{ dealId: string }> };

/** Агреговані показники по угоді (виручка з КП, витрати з транзакцій, оплати клієнта). */
export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { dealId } = await ctx.params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
  }
  const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
  if (denied) return denied;

  try {
    const r = await computeDealFinanceRollup(dealId);
    return NextResponse.json({
      dealId: r.dealId,
      revenueUah: r.revenueUah.toString(),
      expensesUah: r.expensesUah.toString(),
      paidClientUah: r.paidClientUah.toString(),
      profitUah: r.profitUah.toString(),
      marginPct: r.marginPct?.toString() ?? null,
    });
  } catch (e) {
    console.error("[GET finance/summary]", e);
    return NextResponse.json({ error: "Не вдалося порахувати" }, { status: 500 });
  }
}
