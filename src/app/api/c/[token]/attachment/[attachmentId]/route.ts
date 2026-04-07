import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { resolveAttachmentAbsolutePath } from "../../../../../../lib/uploads/lead-disk-upload";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ token: string; attachmentId: string }>;
};

/**
 * Публічне завантаження файлу проєкту для кімнати конструктора (без логіну).
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

  const room = await prisma.dealConstructorRoom.findFirst({
    where: { publicToken: t },
    select: { id: true, dealId: true },
  });
  if (!room) {
    return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
  }

  const att = await prisma.attachment.findFirst({
    where: {
      id: aid,
      deletedAt: null,
      OR: [
        { entityType: "DEAL", entityId: room.dealId },
        { entityType: "CONSTRUCTOR_ROOM", entityId: room.id },
      ],
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
    const url = att.fileUrl?.trim() ?? "";
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return NextResponse.redirect(url);
    }
    return NextResponse.json({ error: "Файл недоступний" }, { status: 400 });
  }

  try {
    const buf = await readFile(abs);
    const safeName = encodeURIComponent(att.fileName || "file").replace(
      /['()*]/g,
      (c) => "%" + c.charCodeAt(0).toString(16),
    );
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": att.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
  }
}
