import { NextResponse } from "next/server";
import type { AttachmentCategory } from "@prisma/client";
import { prisma } from "../../../../../../lib/prisma";
import { isAttachmentUploadCategory } from "../../../../../../lib/attachments/upload-categories";
import { resolveDealUploaderUserId } from "../../../../../../lib/constructor-room/upload-attribution";
import { appendActivityLog } from "../../../../../../lib/deal-api/audit";
import { isAllowedPublicConstructorFileUrl } from "../../../../../../lib/constructor-room/public-file-url";

type Ctx = { params: Promise<{ token: string }> };

const DELIVERY_CATEGORIES: AttachmentCategory[] = ["DRAWING", "TECH_CARD", "SPEC"];

/**
 * Фінальне завантаження креслення / моделі для головного конструктора або начальника виробництва.
 */
export async function POST(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const { token: raw } = await ctx.params;
  const token = raw?.trim();
  if (!token) {
    return NextResponse.json({ error: "Некоректне посилання" }, { status: 400 });
  }

  let body: {
    fileName?: string;
    fileUrl?: string;
    mimeType?: string;
    category?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const fileName =
    typeof body.fileName === "string" ? body.fileName.trim() : "";
  const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
  const mimeType =
    typeof body.mimeType === "string" && body.mimeType.trim()
      ? body.mimeType.trim()
      : "application/octet-stream";

  if (!fileName || !fileUrl) {
    return NextResponse.json(
      { error: "Потрібні fileName та fileUrl" },
      { status: 400 },
    );
  }

  if (!isAllowedPublicConstructorFileUrl(fileUrl)) {
    return NextResponse.json(
      {
        error:
          "URL файлу має бути повним посиланням http(s):// (без javascript/data тощо)",
      },
      { status: 400 },
    );
  }

  if (!body.category || !isAttachmentUploadCategory(body.category)) {
    return NextResponse.json({ error: "Некоректна категорія" }, { status: 400 });
  }

  const category = body.category as AttachmentCategory;
  if (!DELIVERY_CATEGORIES.includes(category)) {
    return NextResponse.json(
      {
        error:
          "Для здачі оберіть категорію креслення / техкартки / специфікації (DRAWING, TECH_CARD, SPEC)",
      },
      { status: 400 },
    );
  }

  try {
    const room = await prisma.dealConstructorRoom.findFirst({
      where: { publicToken: token },
      select: { id: true, dealId: true, status: true },
    });
    if (!room) {
      return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
    }

    if (
      room.status !== "SENT_TO_CONSTRUCTOR" &&
      room.status !== "IN_PROGRESS"
    ) {
      return NextResponse.json(
        {
          error:
            "Здача файлу доступна лише під час роботи конструктора (після відправки завдання).",
        },
        { status: 403 },
      );
    }

    const uploadedById = await resolveDealUploaderUserId(prisma, room.dealId);

    const att = await prisma.$transaction(async (tx) => {
      const a = await tx.attachment.create({
        data: {
          fileName,
          fileUrl,
          mimeType,
          category,
          entityType: "CONSTRUCTOR_ROOM",
          entityId: room.id,
          uploadedById,
        },
        select: { id: true },
      });
      await tx.dealConstructorRoom.update({
        where: { id: room.id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
        },
      });
      return a;
    });

    await appendActivityLog({
      entityType: "DEAL",
      entityId: room.dealId,
      type: "CONSTRUCTOR_ROOM_FILE_DELIVERED",
      actorUserId: uploadedById,
      source: "SYSTEM",
      data: {
        constructorRoomId: room.id,
        attachmentId: att.id,
        fileName,
        category,
      },
    });

    return NextResponse.json({
      ok: true,
      id: att.id,
      downloadPath: `/api/c/${encodeURIComponent(token)}/attachment/${att.id}`,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
