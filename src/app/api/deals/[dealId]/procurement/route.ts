import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDealAccess } from "@/lib/deal-hub-api/access";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { dealId } = await ctx.params;
  const access = await requireDealAccess(dealId);
  if ("error" in access) return access.error;

  const [dealPurchaseOrders, purchaseOrders] = await Promise.all([
    prisma.dealPurchaseOrder.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        expectedDate: true,
        total: true,
        supplier: { select: { id: true, name: true } },
        updatedAt: true,
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        expectedDate: true,
        totalAmount: true,
        updatedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      dealPurchaseOrders,
      purchaseOrders,
    },
  });
}
