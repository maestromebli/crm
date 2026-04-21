import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { createFinanceInvoice } from "../../../../../../lib/finance/invoice-payment-service";
import type { CrmInvoiceType } from "@prisma/client";
import { CORE_EVENT_TYPES, publishEntityEvent } from "@/lib/events/crm-events";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";

type Ctx = { params: Promise<{ dealId: string }> };

const TYPES = new Set<string>(["INCOMING", "OUTGOING"]);

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

  const rows = await prisma.invoice.findMany({
    where: { dealId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      status: true,
      amount: true,
      pdfUrl: true,
      createdAt: true,
      documentNumber: true,
      issueDate: true,
      counterpartyName: true,
      counterpartyEdrpou: true,
      vatRatePercent: true,
      amountWithoutVat: true,
      vatAmount: true,
      dueDate: true,
    },
  });

  return NextResponse.json({
    invoices: rows.map((r) => ({
      ...r,
      amount: r.amount.toString(),
      vatRatePercent: r.vatRatePercent?.toString() ?? null,
      amountWithoutVat: r.amountWithoutVat?.toString() ?? null,
      vatAmount: r.vatAmount?.toString() ?? null,
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
  const typeRaw = typeof o.type === "string" ? o.type.trim() : "";
  if (!TYPES.has(typeRaw)) {
    return NextResponse.json(
      { error: "type має бути PREPAYMENT_70, FINAL_30 або CUSTOM" },
      { status: 400 },
    );
  }
  const amountNum = typeof o.amount === "number" ? o.amount : Number(o.amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "amount має бути додатним числом" }, { status: 400 });
  }

  try {
    const row = await createFinanceInvoice({
      dealId,
      type: typeRaw as CrmInvoiceType,
      amount: amountNum,
      createdById: user.id,
    });
    await publishEntityEvent({
      type: CORE_EVENT_TYPES.INVOICE_CREATED,
      entityType: "DEAL",
      entityId: dealId,
      userId: user.id,
      payload: {
        invoiceId: row.id,
        invoiceType: typeRaw,
        amount: amountNum,
      },
      dedupeKey: `invoice:${row.id}`,
    });
    await recordWorkflowEvent(
      WORKFLOW_EVENT_TYPES.INVOICE_CREATED,
      { dealId, invoiceId: row.id },
      {
        entityType: "DEAL",
        entityId: dealId,
        dealId,
        userId: user.id,
        dedupeKey: `invoice-created:${row.id}`,
      },
    );
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (e) {
    console.error("[POST finance/invoices]", e);
    return NextResponse.json({ error: "Не вдалося створити рахунок" }, { status: 500 });
  }
}
