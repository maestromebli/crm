import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDealAccess } from "@/lib/deal-hub-api/access";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { dealId } = await ctx.params;
  const access = await requireDealAccess(dealId);
  if ("error" in access) return access.error;

  const category = new URL(req.url).searchParams.get("category");
  const files = await prisma.attachment.findMany({
    where: {
      entityType: "DEAL",
      entityId: dealId,
      deletedAt: null,
      ...(category ? { category: category as any } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 120,
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      category: true,
      createdAt: true,
      version: true,
      isCurrentVersion: true,
    },
  });
  return NextResponse.json({ ok: true, data: files });
}
