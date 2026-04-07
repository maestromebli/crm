import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { publishCrmEvent, CRM_EVENT_TYPES } from "@/lib/events/crm-events";

type Ctx = { params: Promise<{ dealId: string }> };

function orderNo(): string {
  return `PO-${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { dealId } = await ctx.params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true, value: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
  }
  const denied = await forbidUnlessDealAccess(user, P.DEALS_UPDATE, deal);
  if (denied) return denied;

  const plan = await prisma.dealPaymentPlan.findUnique({
    where: { dealId },
  });
  const steps = plan?.stepsJson;
  const first = Array.isArray(steps) ? (steps[0] as { status?: string }) : null;
  if (!first || first.status !== "PAID") {
    return NextResponse.json(
      {
        error:
          "Закупівлі доступні після підтвердження авансу (70%). Спочатку відмітьте оплату першого етапу.",
      },
      { status: 400 },
    );
  }

  const estimate = await prisma.estimate.findFirst({
    where: { dealId },
    orderBy: { version: "desc" },
    include: {
      lineItems: {
        where: { type: { in: ["MATERIAL", "FITTING"] } },
      },
    },
  });
  if (!estimate?.lineItems.length) {
    return NextResponse.json(
      { error: "Немає рядків матеріалів/фурнітури в останній сметі." },
      { status: 400 },
    );
  }

  let supplier = await prisma.supplier.findFirst({
    where: { category: "MATERIALS" },
    orderBy: { updatedAt: "desc" },
  });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        name: "Постачальник (за замовчуванням)",
        category: "MATERIALS",
      },
    });
  }

  const itemsJson = estimate.lineItems.map((li) => ({
    materialId: null as string | null,
    name: li.productName,
    code: li.code ?? li.stableLineId,
    qty: li.qty,
    price: li.costPrice ?? li.salePrice,
    unit: li.unit,
  }));

  const total = itemsJson.reduce(
    (a, x) => a + (x.qty * (x.price ?? 0)),
    0,
  );

  const po = await prisma.dealPurchaseOrder.create({
    data: {
      orderNumber: orderNo(),
      supplierId: supplier.id,
      dealId,
      itemsJson,
      total: Math.round(total * 100) / 100,
      status: "DRAFT",
      expectedDate: null,
    },
  });

  // Canonical procurement creation path: DealPurchaseOrder only.
  // Legacy dual-write to ProcurementRequest/PurchaseOrder removed to avoid split versions.

  await prisma.task.create({
    data: {
      title: `Закупівля: ${po.orderNumber}`,
      description: `Автозадача: перевірте та підтвердіть замовлення постачальнику.`,
      entityType: "DEAL",
      entityId: dealId,
      taskType: "OTHER",
      status: "OPEN",
      priority: "HIGH",
      assigneeId: user.id,
      createdById: user.id,
    },
  });
  await publishCrmEvent({
    type: CRM_EVENT_TYPES.PROCUREMENT_CREATED,
    dealId,
    payload: {
      purchaseOrderId: po.id,
      orderNumber: po.orderNumber,
      total,
    },
    dedupeKey: `procurement:${po.id}`,
  });

  revalidatePath(`/deals/${dealId}/workspace`);
  return NextResponse.json({
    id: po.id,
    orderNumber: po.orderNumber,
  });
}
