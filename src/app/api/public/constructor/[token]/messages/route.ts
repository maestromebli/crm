import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";

type Ctx = { params: Promise<{ token: string }> };

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

  let body: { body?: string };
  try {
    body = (await req.json()) as { body?: string };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text || text.length > 12_000) {
    return NextResponse.json(
      { error: "Повідомлення порожнє або занадто довге" },
      { status: 400 },
    );
  }

  try {
    const room = await prisma.dealConstructorRoom.findFirst({
      where: { publicToken: token },
      select: { id: true, status: true },
    });
    if (!room) {
      return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
    }

    if (
      room.status !== "SENT_TO_CONSTRUCTOR" &&
      room.status !== "IN_PROGRESS" &&
      room.status !== "DELIVERED"
    ) {
      return NextResponse.json(
        { error: "Переписка ще не відкрита для конструктора" },
        { status: 403 },
      );
    }

    const msg = await prisma.$transaction(async (tx) => {
      const created = await tx.constructorRoomMessage.create({
        data: {
          roomId: room.id,
          body: text,
          author: "CONSTRUCTOR",
        },
        select: {
          id: true,
          body: true,
          author: true,
          createdAt: true,
        },
      });
      if (room.status === "SENT_TO_CONSTRUCTOR") {
        await tx.dealConstructorRoom.update({
          where: { id: room.id },
          data: { status: "IN_PROGRESS" },
        });
      }
      return created;
    });

    return NextResponse.json({
      message: {
        id: msg.id,
        body: msg.body,
        author: msg.author,
        createdAt: msg.createdAt.toISOString(),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Помилка сервера" }, { status: 500 });
  }
}
