import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { forbidUnlessPermission, requireSessionUser } from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { prisma } from "../../../../../lib/prisma";
import {
  canAccessCalendarEvent,
  resolveAccessContext,
} from "../../../../../lib/authz/data-scope";

type Ctx = { params: Promise<{ eventId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.CALENDAR_VIEW);
  if (denied) return denied;

  const { eventId } = await ctx.params;
  let body: { startAt?: string; endAt?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const startAt =
    typeof body.startAt === "string" ? new Date(body.startAt) : null;
  const endAt = typeof body.endAt === "string" ? new Date(body.endAt) : null;
  if (
    !startAt ||
    !endAt ||
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime())
  ) {
    return NextResponse.json(
      { error: "Потрібні коректні startAt та endAt (ISO)" },
      { status: 400 },
    );
  }
  if (endAt <= startAt) {
    return NextResponse.json(
      { error: "Кінець події має бути пізніше за початок" },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        createdById: true,
        assignedToId: true,
        lead: { select: { ownerId: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Подію не знайдено" }, { status: 404 });
    }
    const accessCtx = await resolveAccessContext(prisma, user);
    const allowed = canAccessCalendarEvent(accessCtx, {
      createdById: existing.createdById,
      assignedToId: existing.assignedToId,
      lead: existing.lead,
    });
    if (!allowed) {
      return NextResponse.json({ error: "Немає прав на зміну" }, { status: 403 });
    }

    await prisma.calendarEvent.update({
      where: { id: eventId },
      data: { startAt, endAt },
    });

    revalidatePath("/calendar");
    return NextResponse.json({ ok: true });
  } catch (e) {
     
    console.error("[PATCH calendar event]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
