import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { loadDealFinancialBreakdown } from "@/lib/finance/deal-financial-summary";
import { moneyFromDb } from "@/lib/finance/money";
import { canFinanceAction } from "@/features/finance/lib/permissions";

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function n(v: unknown): number {
  return moneyFromDb(v);
}

function agingBucket(diffDays: number): "current" | "d1_7" | "d7_30" | "d30_plus" {
  if (diffDays <= 0) return "current";
  if (diffDays <= 7) return "d1_7";
  if (diffDays <= 30) return "d7_30";
  return "d30_plus";
}

function isOptionalSchemaError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

async function safeOptionalList<T>(
  scope: string,
  query: () => Promise<T[]>,
): Promise<T[]> {
  try {
    return await query();
  } catch (error) {
    if (isOptionalSchemaError(error)) {
      console.warn(
        `[api/crm/finance/dashboard] Optional scope unavailable (${scope}): ${
          error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "unknown"
        }`,
      );
      return [];
    }
    throw error;
  }
}

async function safeOptionalCount(
  scope: string,
  query: () => Promise<number>,
): Promise<number> {
  try {
    return await query();
  } catch (error) {
    if (isOptionalSchemaError(error)) {
      console.warn(
        `[api/crm/finance/dashboard] Optional scope unavailable (${scope}): ${
          error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "unknown"
        }`,
      );
      return 0;
    }
    throw error;
  }
}

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canFinanceAction(user, "finance.view")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    const now = new Date();
    const start = monthStart(now);
    const horizon7 = addDays(now, 7);
    const horizon14 = addDays(now, 14);
    const horizon30 = addDays(now, 30);
    const [txs, allPaid, financeTx, paymentPlanEntries, invoices, purchaseOrders, deals] =
      await Promise.all([
        prisma.moneyTransaction.findMany({
          where: {
            OR: [{ paidAt: { gte: start } }, { paidAt: null, createdAt: { gte: start } }],
          },
          select: {
            type: true,
            amount: true,
            status: true,
            paidAt: true,
            createdAt: true,
          },
        }),
        prisma.moneyTransaction.findMany({
          where: { status: "PAID" },
          select: { type: true, amount: true, paidAt: true, createdAt: true },
        }),
        safeOptionalList("FinanceTransaction", () =>
          prisma.financeTransaction.findMany({
            where: { status: { in: ["PLANNED", "CONFIRMED"] } },
            select: {
              id: true,
              type: true,
              amount: true,
              date: true,
              status: true,
              affectsCash: true,
              dealId: true,
            },
          }),
        ),
        safeOptionalList("PaymentPlanEntry", () =>
          prisma.paymentPlanEntry.findMany({
            where: { status: { in: ["PLANNED", "INVOICED", "PARTIALLY_PAID", "OVERDUE"] } },
            select: {
              id: true,
              dealId: true,
              amount: true,
              dueDate: true,
              status: true,
              remainingAmount: true,
            },
          }),
        ),
        safeOptionalList("Invoice", () =>
          prisma.invoice.findMany({
            where: { status: { in: ["DRAFT", "SENT"] } },
            select: { id: true, amount: true, dueDate: true, status: true, dealId: true },
          }),
        ),
        safeOptionalList("PurchaseOrder", () =>
          prisma.purchaseOrder.findMany({
            where: { status: { in: ["SENT", "CONFIRMED", "PARTIAL"] } },
            select: { id: true, totalAmount: true, expectedDate: true, status: true, dealId: true },
          }),
        ),
        prisma.deal.findMany({
          where: { status: { in: ["OPEN", "WON"] } },
          orderBy: { updatedAt: "desc" },
          take: 30,
          select: { id: true, title: true },
        }),
      ]);

    let incomeMonth = 0;
    let expenseMonth = 0;
    for (const t of txs) {
      const dt = t.paidAt ?? t.createdAt;
      if (dt < start) continue;
      const amount = n(t.amount);
      if (t.type === "INCOME" && t.status === "PAID") incomeMonth += amount;
      if (t.type === "EXPENSE" && t.status === "PAID") expenseMonth += amount;
    }

    const byDay = new Map<string, { income: number; expense: number }>();
    for (const t of allPaid) {
      const amount = n(t.amount);
      const dt = t.paidAt ?? t.createdAt;
      const key = dt.toISOString().slice(0, 10);
      const cur = byDay.get(key) ?? { income: 0, expense: 0 };
      if (t.type === "INCOME") cur.income += amount;
      else cur.expense += amount;
      byDay.set(key, cur);
    }

    const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
    let run = 0;
    const cashflow = days.slice(-90).map(([date, v]) => {
      run += v.income - v.expense;
      return {
        date,
        income: v.income,
        expense: v.expense,
        balance: run,
      };
    });

    const balance = run;
    const profit = incomeMonth - expenseMonth;

    const forecast = {
      inflow7: 0,
      inflow14: 0,
      inflow30: 0,
      outflow7: 0,
      outflow14: 0,
      outflow30: 0,
    };
    for (const tx of financeTx) {
      if (!tx.affectsCash) continue;
      const amount = n(tx.amount);
      if (tx.date <= horizon7) {
        if (tx.type === "INCOME") forecast.inflow7 += amount;
        if (tx.type === "EXPENSE") forecast.outflow7 += amount;
      }
      if (tx.date <= horizon14) {
        if (tx.type === "INCOME") forecast.inflow14 += amount;
        if (tx.type === "EXPENSE") forecast.outflow14 += amount;
      }
      if (tx.date <= horizon30) {
        if (tx.type === "INCOME") forecast.inflow30 += amount;
        if (tx.type === "EXPENSE") forecast.outflow30 += amount;
      }
    }
    for (const pp of paymentPlanEntries) {
      const remaining = n(pp.remainingAmount) > 0 ? n(pp.remainingAmount) : n(pp.amount);
      if (pp.dueDate <= horizon7) forecast.inflow7 += remaining;
      if (pp.dueDate <= horizon14) forecast.inflow14 += remaining;
      if (pp.dueDate <= horizon30) forecast.inflow30 += remaining;
    }
    for (const po of purchaseOrders) {
      if (!po.expectedDate) continue;
      const amount = n(po.totalAmount);
      if (po.expectedDate <= horizon7) forecast.outflow7 += amount;
      if (po.expectedDate <= horizon14) forecast.outflow14 += amount;
      if (po.expectedDate <= horizon30) forecast.outflow30 += amount;
    }

    const receivablesAging: Record<"current" | "d1_7" | "d7_30" | "d30_plus", number> = {
      current: 0,
      d1_7: 0,
      d7_30: 0,
      d30_plus: 0,
    };
    for (const pp of paymentPlanEntries) {
      const amount = n(pp.remainingAmount) > 0 ? n(pp.remainingAmount) : n(pp.amount);
      const diff = Math.floor((now.getTime() - pp.dueDate.getTime()) / (24 * 60 * 60 * 1000));
      const bucket = agingBucket(diff);
      receivablesAging[bucket] += amount;
    }

    const payablesAging: Record<"current" | "d1_7" | "d7_30" | "d30_plus", number> = {
      current: 0,
      d1_7: 0,
      d7_30: 0,
      d30_plus: 0,
    };
    for (const tx of financeTx.filter((t) => t.type === "EXPENSE")) {
      const amount = n(tx.amount);
      const diff = Math.floor((now.getTime() - tx.date.getTime()) / (24 * 60 * 60 * 1000));
      const bucket = agingBucket(diff);
      payablesAging[bucket] += amount;
    }
    for (const inv of invoices) {
      if (!inv.dueDate) continue;
      const amount = n(inv.amount);
      const diff = Math.floor((now.getTime() - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000));
      if (diff <= 0) continue;
      const bucket = agingBucket(diff);
      payablesAging[bucket] += amount;
    }

    const dealTitleById = new Map(deals.map((d) => [d.id, d.title]));
    const arByDeal = new Map<string, { invoiced: number; received: number; dueDate: Date | null }>();
    for (const p of paymentPlanEntries) {
      const due = arByDeal.get(p.dealId) ?? { invoiced: 0, received: 0, dueDate: null };
      due.invoiced += n(p.amount);
      due.received += Math.max(n(p.amount) - Math.max(n(p.remainingAmount), 0), 0);
      due.dueDate =
        due.dueDate && p.dueDate > due.dueDate
          ? due.dueDate
          : p.dueDate;
      arByDeal.set(p.dealId, due);
    }
    const arLedger = [...arByDeal.entries()]
      .map(([dealId, v]) => ({
        dealId,
        dealTitle: dealTitleById.get(dealId) ?? "—",
        invoiced: v.invoiced,
        received: v.received,
        outstanding: Math.max(v.invoiced - v.received, 0),
        dueDate: v.dueDate?.toISOString() ?? null,
      }))
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 12);

    const apLedger = purchaseOrders
      .map((po) => {
        const total = n(po.totalAmount);
        const paid = po.status === "PAID" ? total : 0;
        return {
          purchaseOrderId: po.id,
          dealId: po.dealId,
          dealTitle: po.dealId ? (dealTitleById.get(po.dealId) ?? "—") : "—",
          total,
          paid,
          outstanding: Math.max(total - paid, 0),
          expectedDate: po.expectedDate?.toISOString() ?? null,
          status: po.status,
        };
      })
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 12);

    const avgInflowWeek = forecast.inflow30 / 4.3;
    const avgOutflowWeek = forecast.outflow30 / 4.3;
    const cashflowForecast8w = Array.from({ length: 8 }).map((_, i) => {
      const w = i + 1;
      const inflow = Math.round(avgInflowWeek * (1 + (i % 3 === 0 ? 0.06 : 0)));
      const outflow = Math.round(avgOutflowWeek * (1 + (i % 4 === 1 ? 0.05 : 0)));
      const net = inflow - outflow;
      return {
        week: `W${w}`,
        inflow,
        outflow,
        net,
        projectedBalance: Math.round(balance + net * w),
      };
    });

    const riskyDealsRaw = await Promise.all(
      deals.map(async (deal) => {
        const breakdown = await loadDealFinancialBreakdown(deal.id);
        if (!breakdown) return null;
        return {
          dealId: deal.id,
          dealTitle: deal.title,
          riskLevel: breakdown.summary.riskLevel,
          cashGap: breakdown.summary.cashGap,
          marginPercent: breakdown.summary.marginPercent,
        };
      }),
    );
    const riskyDeals = riskyDealsRaw
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
      .filter((d) => d.riskLevel !== "low")
      .sort((a, b) => b.cashGap - a.cashGap)
      .slice(0, 8);

    const overduePayments = paymentPlanEntries.filter((p) => p.dueDate < now).length;
    const marginLeaks = riskyDeals.filter((d) => d.marginPercent < 20).length;
    const payrollDue = await safeOptionalCount("PayrollEntry", () =>
      prisma.payrollEntry.count({
        where: { status: { in: ["PENDING", "APPROVED"] } },
      }),
    );

    const ai = {
      paymentRisk:
        forecast.inflow30 < forecast.outflow30
          ? "Очікується дефіцит грошового потоку за 30 днів."
          : "Короткостроковий cashflow збалансований.",
      cashflowForecast:
        `Net projection 30 днів: ${(forecast.inflow30 - forecast.outflow30).toFixed(0)} ₴`,
      actions: [
        overduePayments > 0 ? `Є прострочені платежі клієнтів: ${overduePayments}` : null,
        marginLeaks > 0 ? `Зафіксовано угоди з просіданням маржі: ${marginLeaks}` : null,
        payrollDue > 0 ? `Невиплачені payroll записи: ${payrollDue}` : null,
      ].filter((x): x is string => Boolean(x)),
    };
    const riskIndex = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (overduePayments > 0 ? 35 : 8) +
            (forecast.inflow30 < forecast.outflow30 ? 25 : 10) +
            (marginLeaks > 0 ? 20 : 8) +
            (payrollDue > 0 ? 12 : 5),
        ),
      ),
    );
    const riskLabel = riskIndex >= 70 ? "Критичний" : riskIndex >= 45 ? "Підвищений" : "Контрольований";

    return NextResponse.json({
      kpi: {
        balance,
        incomeMonth,
        expenseMonth,
        profit,
      },
      cashflow,
      forecast: {
        inflow7: forecast.inflow7,
        inflow14: forecast.inflow14,
        inflow30: forecast.inflow30,
        outflow7: forecast.outflow7,
        outflow14: forecast.outflow14,
        outflow30: forecast.outflow30,
        net7: forecast.inflow7 - forecast.outflow7,
        net14: forecast.inflow14 - forecast.outflow14,
        net30: forecast.inflow30 - forecast.outflow30,
        deficitDetected: forecast.inflow30 < forecast.outflow30,
      },
      aging: {
        receivables: receivablesAging,
        payables: payablesAging,
      },
      commandCenter: {
        totalCash: balance,
        expectedInflow: forecast.inflow30,
        expectedOutflow: forecast.outflow30,
        overduePayments,
        riskyDeals,
        marginLeaks,
        payrollDue,
      },
      enterprise: {
        arLedger,
        apLedger,
        cashflowForecast8w,
        riskIndex,
        riskLabel,
      },
      ai,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/finance/dashboard]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
