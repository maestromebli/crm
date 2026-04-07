import { NextResponse } from "next/server";
import type { ConstructorRoomStatus, TaskPriority } from "@prisma/client";
import { prisma } from "../../../../../lib/prisma";
import { appendActivityLog } from "../../../../../lib/deal-api/audit";
import { settingsUsersListWhere } from "../../../../../lib/authz/data-scope";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { newConstructorPublicToken } from "../../../../../lib/constructor-room/token";
import { dealConstructorRoomApiSelect } from "../../../../../lib/constructor-room/workspace-room-map";

const TASK_PRIORITIES: TaskPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;

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
      select: dealConstructorRoomApiSelect(),
    });

    return NextResponse.json({ room });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Помилка сервера" }, { status: 500 });
  }
}

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

  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  if (body.action !== "ensure") {
    return NextResponse.json({ error: "Невідома дія" }, { status: 400 });
  }

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { productionOrders: { take: 1 }, handoff: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.PRODUCTION_LAUNCH, {
      ownerId: deal.ownerId,
    });
    if (denied) return denied;

    if (deal.handoff?.status !== "ACCEPTED") {
      return NextResponse.json(
        {
          error:
            "Кімнату конструктора можна відкрити після прийнятої передачі у виробництво.",
        },
        { status: 400 },
      );
    }
    if (!deal.productionOrders?.length) {
      return NextResponse.json(
        {
          error:
            "Спочатку передайте угоду у виробництво (вкладка «Виробництво»).",
        },
        { status: 400 },
      );
    }

    const existing = await prisma.dealConstructorRoom.findUnique({
      where: { dealId },
    });
    if (existing) {
      const room = await prisma.dealConstructorRoom.findUnique({
        where: { dealId },
        select: dealConstructorRoomApiSelect(),
      });
      return NextResponse.json({ room });
    }

    const room = await prisma.dealConstructorRoom.create({
      data: {
        dealId,
        publicToken: newConstructorPublicToken(),
        assignedById: user.id,
      },
      select: dealConstructorRoomApiSelect(),
    });

    await appendActivityLog({
      entityType: "DEAL",
      entityId: dealId,
      type: "CONSTRUCTOR_ROOM_CREATED",
      actorUserId: user.id,
      data: { constructorRoomId: room.id },
    });

    return NextResponse.json({ room });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Помилка сервера" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;

  let body: {
    assignedUserId?: string | null;
    externalConstructorLabel?: string | null;
    telegramInviteUrl?: string | null;
    telegramChatId?: string | null;
    aiQaJson?: unknown;
    priority?: string;
    dueAt?: string | null;
    sendToConstructor?: boolean;
    markReviewed?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
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

    const roomRow = await prisma.dealConstructorRoom.findUnique({
      where: { dealId },
    });
    if (!roomRow) {
      return NextResponse.json(
        { error: "Спочатку створіть кімнату конструктора." },
        { status: 404 },
      );
    }

    const data: {
      assignedUserId?: string | null;
      externalConstructorLabel?: string | null;
      telegramInviteUrl?: string | null;
      telegramChatId?: string | null;
      aiQaJson?: object | null;
      priority?: TaskPriority;
      dueAt?: Date | null;
      status?: ConstructorRoomStatus;
      sentToConstructorAt?: Date | null;
      reviewedAt?: Date | null;
    } = {};

    if ("assignedUserId" in body) {
      data.assignedUserId =
        typeof body.assignedUserId === "string" && body.assignedUserId.trim()
          ? body.assignedUserId.trim()
          : null;
    }
    if ("externalConstructorLabel" in body) {
      data.externalConstructorLabel =
        body.externalConstructorLabel === null
          ? null
          : String(body.externalConstructorLabel).trim() || null;
    }
    if ("telegramInviteUrl" in body) {
      data.telegramInviteUrl =
        body.telegramInviteUrl === null
          ? null
          : String(body.telegramInviteUrl).trim() || null;
    }
    if ("telegramChatId" in body) {
      data.telegramChatId =
        body.telegramChatId === null
          ? null
          : String(body.telegramChatId).trim() || null;
    }
    if ("aiQaJson" in body) {
      if (body.aiQaJson === null || body.aiQaJson === undefined) {
        data.aiQaJson = null;
      } else if (Array.isArray(body.aiQaJson)) {
        data.aiQaJson = body.aiQaJson as object;
      } else {
        return NextResponse.json(
          { error: "aiQaJson має бути масивом або null" },
          { status: 400 },
        );
      }
    }

    if ("priority" in body && body.priority !== undefined) {
      if (
        typeof body.priority === "string" &&
        TASK_PRIORITIES.includes(body.priority as TaskPriority)
      ) {
        data.priority = body.priority as TaskPriority;
      } else {
        return NextResponse.json(
          { error: "Некоректний priority (LOW | NORMAL | HIGH | URGENT)" },
          { status: 400 },
        );
      }
    }

    if ("dueAt" in body) {
      if (body.dueAt === null || body.dueAt === "") {
        data.dueAt = null;
      } else if (typeof body.dueAt === "string") {
        const d = new Date(body.dueAt);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json(
            { error: "Некоректна дата dueAt" },
            { status: 400 },
          );
        }
        data.dueAt = d;
      }
    }

    if (body.sendToConstructor === true) {
      if (
        roomRow.status === "PENDING_ASSIGNMENT" ||
        roomRow.status === "SENT_TO_CONSTRUCTOR"
      ) {
        data.status = "SENT_TO_CONSTRUCTOR";
        data.sentToConstructorAt = new Date();
      }
    }

    if (body.markReviewed === true) {
      if (roomRow.status !== "DELIVERED") {
        return NextResponse.json(
          {
            error:
              "Позначити «перевірено» можна лише після здачі файлу конструктором.",
          },
          { status: 400 },
        );
      }
      data.status = "REVIEWED";
      data.reviewedAt = new Date();
    }

    if (data.assignedUserId) {
      const listWhere = await settingsUsersListWhere(prisma, {
        id: user.id,
        role: user.dbRole,
      });
      const allowed = await prisma.user.findFirst({
        where: { id: data.assignedUserId, ...(listWhere ?? {}) },
        select: { id: true },
      });
      if (!allowed) {
        return NextResponse.json(
          { error: "Обраного користувача немає у доступному списку" },
          { status: 400 },
        );
      }
    }

    if (Object.keys(data).length === 0) {
      const unchanged = await prisma.dealConstructorRoom.findUnique({
        where: { dealId },
        select: dealConstructorRoomApiSelect(),
      });
      return NextResponse.json({ room: unchanged });
    }

    const room = await prisma.dealConstructorRoom.update({
      where: { dealId },
      data,
      select: dealConstructorRoomApiSelect(),
    });

    if ("sentToConstructorAt" in data && data.sentToConstructorAt) {
      await appendActivityLog({
        entityType: "DEAL",
        entityId: dealId,
        type: "CONSTRUCTOR_ROOM_SENT",
        actorUserId: user.id,
        data: { constructorRoomId: room.id },
      });
    }
    if ("reviewedAt" in data && data.reviewedAt) {
      await appendActivityLog({
        entityType: "DEAL",
        entityId: dealId,
        type: "CONSTRUCTOR_ROOM_REVIEWED",
        actorUserId: user.id,
        data: { constructorRoomId: room.id },
      });
    }

    return NextResponse.json({ room });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Помилка сервера" }, { status: 500 });
  }
}
