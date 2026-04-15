import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDealAccess } from "@/lib/deal-hub-api/access";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { dealId } = await ctx.params;
  const access = await requireDealAccess(dealId);
  if ("error" in access) return access.error;

  const [contract, attachments, invoices] = await Promise.all([
    prisma.dealContract.findUnique({
      where: { dealId },
      select: {
        id: true,
        status: true,
        templateKey: true,
        version: true,
        signedPdfUrl: true,
        updatedAt: true,
      },
    }),
    prisma.attachment.findMany({
      where: {
        entityType: "DEAL",
        entityId: dealId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        category: true,
        createdAt: true,
      },
    }),
    prisma.invoice.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        dueDate: true,
        pdfUrl: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      contract,
      attachments,
      invoices,
    },
  });
}
