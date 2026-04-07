import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { forbidUnlessAttachmentReadAccess } from "../../../../../lib/attachments/attachment-download-access";
import { requireSessionUser } from "../../../../../lib/authz/api-guard";
import { prisma } from "../../../../../lib/prisma";
import { resolveAttachmentAbsolutePath } from "../../../../../lib/uploads/lead-disk-upload";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ attachmentId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { attachmentId } = await ctx.params;
  if (!attachmentId?.trim()) {
    return NextResponse.json({ error: "Некоректний id" }, { status: 400 });
  }

  const att = await prisma.attachment.findFirst({
    where: { id: attachmentId.trim(), deletedAt: null },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileUrl: true,
      storageKey: true,
      entityType: true,
      entityId: true,
    },
  });

  if (!att) {
    return NextResponse.json({ error: "Файл не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessAttachmentReadAccess(user, att);
  if (denied) return denied;

  const abs = resolveAttachmentAbsolutePath({
    storageKey: att.storageKey,
    fileUrl: att.fileUrl,
  });
  if (!abs) {
    return NextResponse.json(
      { error: "Неможливо визначити шлях до файлу" },
      { status: 400 },
    );
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
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Не вдалося прочитати файл" },
      { status: 404 },
    );
  }
}
