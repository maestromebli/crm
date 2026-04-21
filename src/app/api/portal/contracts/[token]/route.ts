import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashShareToken, mapContractDetails } from "@/lib/contracts/service";

type Ctx = { params: Promise<{ token: string }> };

function normalizeLegacyContractStatus(status: string): string {
  if (status === "VIEWED_BY_CUSTOMER") return "VIEWED_BY_CLIENT";
  if (status === "SENT_TO_CUSTOMER") return "SENT_FOR_SIGNATURE";
  return status;
}

function toPortalError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const tokenHash = hashShareToken(token);
  const share = await (prisma as any).dealContractShareLink.findUnique({
    where: { tokenHash },
    include: { contract: true },
  });

  if (!share) return toPortalError(404, "Посилання не знайдено");
  if (share.status !== "ACTIVE") return toPortalError(410, "Посилання деактивоване");
  if (share.expiresAt < new Date()) {
    await (prisma as any).dealContractShareLink.update({
      where: { id: share.id },
      data: { status: "EXPIRED" },
    });
    return toPortalError(410, "Термін дії посилання завершився");
  }
  if (share.maxViews && share.viewCount >= share.maxViews) {
    return toPortalError(410, "Ліміт переглядів вичерпано");
  }

  const docs = await prisma.attachment.findMany({
    where: {
      entityType: "DEAL",
      entityId: share.contract.dealId,
      deletedAt: null,
      category: { in: ["CONTRACT", "SPEC"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      category: true,
      createdAt: true,
    },
  });

  const details = mapContractDetails(share.contract);

  return NextResponse.json({
    ok: true,
    data: {
      contract: {
        ...details,
        status: normalizeLegacyContractStatus(details.status),
      },
      share: {
        expiresAt: share.expiresAt.toISOString(),
        status: share.status,
        viewCount: share.viewCount,
      },
      documents: docs.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        type: doc.category,
        createdAt: doc.createdAt.toISOString(),
      })),
    },
  });
}
