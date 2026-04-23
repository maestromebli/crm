import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { computeDealFinanceRollup } from "@/lib/finance/deal-finance-rollup";
import { loadDealFinancialBreakdown } from "@/lib/finance/deal-financial-summary";

type Ctx = { params: Promise<{ dealId: string }> };

function canViewCompensationDetails(realRole: string): boolean {
  return (
    realRole === "SUPER_ADMIN" ||
    realRole === "ADMIN" ||
    realRole === "DIRECTOR" ||
    realRole === "DIRECTOR_PRODUCTION" ||
    realRole === "ACCOUNTANT"
  );
}

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
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }
  const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
  if (denied) return denied;
  const canViewCompensation = canViewCompensationDetails(user.realRole);

  const [plan, invoices, txs, purchaseOrders, estimate, controlTower] = await Promise.all([
    prisma.dealPaymentPlan.findUnique({ where: { dealId } }),
    prisma.invoice.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.moneyTransaction.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.dealPurchaseOrder.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { supplier: { select: { id: true, name: true } } },
    }),
    prisma.estimate.findFirst({
      where: { dealId },
      orderBy: { version: "desc" },
      include: {
        lineItems: {
          where: { type: { in: ["MATERIAL", "FITTING"] } },
          take: 500,
        },
      },
    }),
    loadDealFinancialBreakdown(dealId),
  ]);

  let rollup;
  try {
    rollup = await computeDealFinanceRollup(dealId);
  } catch {
    rollup = null;
  }

  const estimatedCost =
    estimate?.lineItems?.reduce((a, li) => a + (li.amountCost ?? 0), 0) ?? 0;

  const actualPurchase = purchaseOrders
    .filter((p) => p.status !== "CANCELED")
    .reduce((a, p) => a + Number(p.total), 0);

  return NextResponse.json({
    paymentPlan: plan,
    invoices: invoices.map((i) => ({
      ...i,
      amount: i.amount.toString(),
    })),
    transactions: txs.map((t) => ({
      ...t,
      amount: t.amount.toString(),
    })),
    purchaseOrders: purchaseOrders.map((p) => ({
      ...p,
      total: p.total.toString(),
    })),
    rollup: rollup
      ? {
          revenueUah: rollup.revenueUah.toString(),
          expensesUah: rollup.expensesUah.toString(),
          paidClientUah: rollup.paidClientUah.toString(),
          profitUah: rollup.profitUah.toString(),
          marginPct: rollup.marginPct?.toString() ?? null,
        }
      : null,
    estimateSummary: {
      estimatedCost,
      actualPurchase,
      lineCount: estimate?.lineItems?.length ?? 0,
    },
    dealFinancialSummary: controlTower?.summary
      ? {
          ...controlTower.summary,
          payrollTotal: canViewCompensation ? controlTower.summary.payrollTotal : 0,
          commissionsTotal: canViewCompensation
            ? controlTower.summary.commissionsTotal
            : 0,
        }
      : null,
    dealFinancialTabs: controlTower
      ? {
          payments: controlTower.payments,
          expenses: controlTower.expenses,
          procurement: controlTower.procurement,
          payroll: canViewCompensation ? controlTower.payroll : [],
          commissions: canViewCompensation ? controlTower.commissions : [],
          profitability: controlTower.summary,
        }
      : {
          payments: [],
          expenses: [],
          procurement: [],
          payroll: [],
          commissions: [],
          profitability: null,
        },
  });
}
