import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import {
  dealConstructorRoomApiSelect,
  mapPrismaConstructorRoomToWorkspacePayload,
} from "../../../../../../lib/constructor-room/workspace-room-map";

type Ctx = { params: Promise<{ dealId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;

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
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.PRODUCTION_LAUNCH, {
      ownerId: deal.ownerId,
    });
    if (denied) return denied;

    const room = await prisma.dealConstructorRoom.findUnique({
      where: { dealId },
      select: { id: true, status: true },
    });
    if (!room) {
      return NextResponse.json(
        { error: "Кімнату не знайдено" },
        { status: 404 },
      );
    }

    const msg = await prisma.constructorRoomMessage.create({
      data: {
        roomId: room.id,
        body: text,
        author: "INTERNAL",
        createdById: user.id,
      },
      select: {
        id: true,
        body: true,
        author: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
      },
    });

    const full = await prisma.dealConstructorRoom.findUnique({
      where: { dealId },
      select: dealConstructorRoomApiSelect(),
    });
    if (!full) {
      return NextResponse.json({ message: msg });
    }

    return NextResponse.json({
      message: msg,
      room: mapPrismaConstructorRoomToWorkspacePayload(full),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Помилка сервера" }, { status: 500 });
  }
}
