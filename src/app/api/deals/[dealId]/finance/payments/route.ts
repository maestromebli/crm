import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { recordIncomingPayment } from "../../../../../../lib/finance/invoice-payment-service";
import type { MoneyTransactionCategory } from "@prisma/client";
import {
  publishCrmEvent,
  publishEntityEvent,
  CRM_EVENT_TYPES,
  CORE_EVENT_TYPES,
} from "@/lib/events/crm-events";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";

type Ctx = { params: Promise<{ dealId: string }> };

const CATEGORIES = new Set<string>([
  "PREPAYMENT",
  "FINAL_PAYMENT",
  "MATERIALS",
  "SALARY",
  "OTHER",
]);

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

  const rows = await prisma.moneyTransaction.findMany({
    where: { dealId, type: "INCOME" },
    orderBy: { paidAt: "desc" },
    select: {
      id: true,
      amount: true,
      currency: true,
      category: true,
      paidAt: true,
      status: true,
      description: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    payments: rows.map((r) => ({
      ...r,
      amount: r.amount.toString(),
    })),
  });
}

export async function POST(req: Request, ctx: Ctx) {
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
  const denied = await forbidUnlessDealAccess(user, P.PAYMENTS_UPDATE, deal);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Очікується об'єкт" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;

  const amountNum = typeof o.amount === "number" ? o.amount : Number(o.amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "amount має бути додатним числом" }, { status: 400 });
  }

  const paidAt =
    typeof o.paidAt === "string" && o.paidAt.trim() !== ""
      ? new Date(o.paidAt)
      : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    return NextResponse.json({ error: "paidAt некоректна" }, { status: 400 });
  }

  const catRaw =
    typeof o.category === "string" ? o.category.trim() : "PREPAYMENT";
  if (!CATEGORIES.has(catRaw)) {
    return NextResponse.json(
      { error: "category: PREPAYMENT, FINAL_PAYMENT, …" },
      { status: 400 },
    );
  }

  try {
    const row = await recordIncomingPayment({
      dealId,
      amount: amountNum,
      currency: typeof o.currency === "string" ? o.currency : undefined,
      paidAt,
      category: catRaw as MoneyTransactionCategory,
      description: typeof o.comment === "string" ? o.comment : null,
      createdById: user.id,
    });
    const txAgg = await prisma.moneyTransaction.aggregate({
      where: { dealId, type: "INCOME", status: "PAID" },
      _sum: { amount: true },
    });
    const dealSum = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { value: true },
    });
    const paid = Number(txAgg._sum.amount ?? 0);
    const total = Number(dealSum?.value ?? 0);
    const amountPercent = total > 0 ? (paid / total) * 100 : 0;
    const commissions = await prisma.commission.findMany({
      where: { dealId, status: { in: ["PENDING", "APPROVED"] } },
      select: { id: true, percent: true },
    });
    await Promise.all(
      commissions.map((c) => {
        const pct = Number(c.percent ?? 0);
        if (!Number.isFinite(pct) || pct <= 0) return Promise.resolve();
        return prisma.commission.update({
          where: { id: c.id },
          data: { amount: (paid * pct) / 100 },
        });
      }),
    );
    await publishCrmEvent({
      type: CRM_EVENT_TYPES.PAYMENT_RECEIVED,
      dealId,
      payload: {
        transactionId: row.id,
        amount: amountNum,
        amountPercent,
        percent70Reached: amountPercent >= 70,
      },
      dedupeKey: `payment:${row.id}`,
    });
    await publishEntityEvent({
      type: CORE_EVENT_TYPES.PAYMENT_RECEIVED,
      entityType: "DEAL",
      entityId: dealId,
      userId: user.id,
      payload: {
        transactionId: row.id,
        amount: amountNum,
      },
      dedupeKey: `payment:core:${row.id}`,
    });
    await recordWorkflowEvent(
      WORKFLOW_EVENT_TYPES.PAYMENT_RECEIVED,
      { dealId, paymentId: row.id },
      {
        entityType: "DEAL",
        entityId: dealId,
        dealId,
        userId: user.id,
        dedupeKey: `payment-received:${row.id}`,
      },
    );
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Помилка";
    console.error("[POST finance/payments]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
