import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { resolveAttachmentAbsolutePath } from "../../../../../../lib/uploads/lead-disk-upload";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ token: string; attachmentId: string }>;
};

/**
 * Публічне зображення для КП (без логіну): тільки якщо token валідний і файл належить ліду цієї КП.
 */
export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const { token, attachmentId } = await ctx.params;
  const t = token?.trim();
  const aid = attachmentId?.trim();
  if (!t || !aid) {
    return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });
  }

  const proposal = await prisma.leadProposal.findFirst({
    where: { publicToken: t },
    select: { leadId: true },
  });
  if (!proposal) {
    return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
  }

  const att = await prisma.attachment.findFirst({
    where: {
      id: aid,
      entityType: "LEAD",
      entityId: proposal.leadId,
      deletedAt: null,
      mimeType: { startsWith: "image/" },
    },
    select: {
      fileName: true,
      mimeType: true,
      fileUrl: true,
      storageKey: true,
    },
  });

  if (!att) {
    return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
  }

  const abs = resolveAttachmentAbsolutePath({
    storageKey: att.storageKey,
    fileUrl: att.fileUrl,
  });
  if (!abs) {
    return NextResponse.json({ error: "Файл недоступний" }, { status: 400 });
  }

  try {
    const buf = await readFile(abs);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": att.mimeType || "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
  }
}
