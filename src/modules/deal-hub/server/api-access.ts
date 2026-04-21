import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidUnlessDealAccess, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";

export async function requireDealAccess(
  dealId: string,
  requiredPermission: (typeof P)[keyof typeof P] = P.DEALS_VIEW,
) {
  if (!process.env.DATABASE_URL?.trim()) {
    return { error: NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 }) };
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) {
    return { error: user };
  }
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, ownerId: true },
  });
  if (!deal) {
    return { error: NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 }) };
  }
  const denied = await forbidUnlessDealAccess(user, requiredPermission, deal);
  if (denied) return { error: denied };
  return { user, deal };
}
