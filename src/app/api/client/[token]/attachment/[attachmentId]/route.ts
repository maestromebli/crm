import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyClientPortalToken } from "@/lib/client-portal/token";

type Ctx = { params: Promise<{ token: string; attachmentId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { token, attachmentId } = await ctx.params;
  const payload = verifyClientPortalToken(token);
  if (!payload) return NextResponse.json({ error: "Некоректний токен" }, { status: 401 });

  const file = await prisma.attachment.findFirst({
    where: {
      id: attachmentId,
      entityType: "DEAL",
      entityId: payload.dealId,
      deletedAt: null,
    },
    select: { fileUrl: true },
  });
  if (!file) return NextResponse.json({ error: "Файл не знайдено" }, { status: 404 });
  return NextResponse.redirect(file.fileUrl);
}
