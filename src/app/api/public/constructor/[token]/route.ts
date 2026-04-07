import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
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

  try {
    const room = await prisma.dealConstructorRoom.findFirst({
      where: { publicToken: token },
      select: {
        id: true,
        status: true,
        telegramInviteUrl: true,
        aiQaJson: true,
        priority: true,
        dueAt: true,
        deal: {
          select: {
            id: true,
            title: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 300,
          select: {
            id: true,
            body: true,
            author: true,
            createdAt: true,
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
    }

    const dealId = room.deal.id;

    const [dealAttachments, roomAttachments] = await Promise.all([
      prisma.attachment.findMany({
        where: {
          entityType: "DEAL",
          entityId: dealId,
          deletedAt: null,
          isCurrentVersion: true,
        },
        orderBy: { createdAt: "desc" },
        take: 80,
        select: {
          id: true,
          fileName: true,
          category: true,
          mimeType: true,
          createdAt: true,
        },
      }),
      prisma.attachment.findMany({
        where: {
          entityType: "CONSTRUCTOR_ROOM",
          entityId: room.id,
          deletedAt: null,
          isCurrentVersion: true,
        },
        orderBy: { createdAt: "desc" },
        take: 80,
        select: {
          id: true,
          fileName: true,
          category: true,
          mimeType: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      dealTitle: room.deal.title,
      roomId: room.id,
      status: room.status,
      telegramInviteUrl: room.telegramInviteUrl,
      aiQaJson: room.aiQaJson,
      priority: room.priority,
      dueAt: room.dueAt?.toISOString() ?? null,
      messages: room.messages.map((m) => ({
        id: m.id,
        body: m.body,
        author: m.author,
        createdAt: m.createdAt.toISOString(),
      })),
      dealAttachments: dealAttachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        category: a.category,
        mimeType: a.mimeType,
        createdAt: a.createdAt.toISOString(),
        downloadPath: `/api/c/${encodeURIComponent(token)}/attachment/${a.id}`,
      })),
      roomAttachments: roomAttachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        category: a.category,
        mimeType: a.mimeType,
        createdAt: a.createdAt.toISOString(),
        downloadPath: `/api/c/${encodeURIComponent(token)}/attachment/${a.id}`,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Помилка сервера" }, { status: 500 });
  }
}
