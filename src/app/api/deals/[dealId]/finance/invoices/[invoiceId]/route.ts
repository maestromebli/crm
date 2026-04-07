import { NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../../lib/authz/permissions";
import { updateFinanceInvoiceStatus } from "../../../../../../../lib/finance/invoice-payment-service";
import type { CrmInvoiceStatus } from "@prisma/client";

type Ctx = { params: Promise<{ dealId: string; invoiceId: string }> };

const STATUSES = new Set<string>(["DRAFT", "SENT", "PAID"]);

export async function PATCH(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { dealId, invoiceId } = await ctx.params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
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
  const statusRaw = typeof o.status === "string" ? o.status.trim() : "";
  if (!STATUSES.has(statusRaw)) {
    return NextResponse.json({ error: "status некоректний" }, { status: 400 });
  }

  const exists = await prisma.invoice.findFirst({
    where: { id: invoiceId, dealId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Рахунок не знайдено" }, { status: 404 });
  }

  try {
    await updateFinanceInvoiceStatus({
      invoiceId,
      dealId,
      status: statusRaw as CrmInvoiceStatus,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PATCH finance/invoices]", e);
    return NextResponse.json({ error: "Не вдалося оновити" }, { status: 500 });
  }
}
