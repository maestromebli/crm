import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { forbidUnlessPermission, requireSessionUser } from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { prisma } from "../../../../../lib/prisma";
import {
  canAccessCalendarEvent,
  resolveAccessContext,
} from "../../../../../lib/authz/data-scope";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";
import type { CalendarEventStatus } from "@prisma/client";

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
  let body: { startAt?: string; endAt?: string; status?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const hasStartAt = typeof body.startAt === "string";
  const hasEndAt = typeof body.endAt === "string";
  const hasStatus = typeof body.status === "string";

  const startAt = hasStartAt ? new Date(body.startAt as string) : null;
  const endAt = hasEndAt ? new Date(body.endAt as string) : null;

  if ((hasStartAt && !hasEndAt) || (!hasStartAt && hasEndAt)) {
    return NextResponse.json(
      { error: "Потрібні обидва поля startAt та endAt" },
      { status: 400 },
    );
  }
  if (hasStartAt && hasEndAt) {
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
  }

  const allowedStatuses = new Set<CalendarEventStatus>([
    "PLANNED",
    "CONFIRMED",
    "COMPLETED",
    "CANCELED",
  ]);
  const nextStatusRaw = hasStatus ? (body.status as string).trim().toUpperCase() : null;
  if (nextStatusRaw && !allowedStatuses.has(nextStatusRaw as CalendarEventStatus)) {
    return NextResponse.json({ error: "Некоректний status" }, { status: 400 });
  }
  if (!hasStartAt && !hasEndAt && !nextStatusRaw) {
    return NextResponse.json(
      { error: "Немає полів для оновлення" },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        type: true,
        status: true,
        leadId: true,
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

    const data: {
      startAt?: Date;
      endAt?: Date;
      status?: CalendarEventStatus;
    } = {};
    if (hasStartAt && hasEndAt && startAt && endAt) {
      data.startAt = startAt;
      data.endAt = endAt;
    }
    if (nextStatusRaw) {
      data.status = nextStatusRaw as CalendarEventStatus;
    }

    await prisma.calendarEvent.update({
      where: { id: eventId },
      data,
    });
    if (
      existing.type === "MEASUREMENT" &&
      existing.leadId &&
      existing.status !== "COMPLETED" &&
      data.status === "COMPLETED"
    ) {
      await recordWorkflowEvent(
        WORKFLOW_EVENT_TYPES.MEASUREMENT_DONE,
        { leadId: existing.leadId, eventId },
        {
          entityType: "LEAD",
          entityId: existing.leadId,
          userId: user.id,
          dedupeKey: `measurement-done:${eventId}`,
        },
      );
    }

    revalidatePath("/calendar");
    return NextResponse.json({ ok: true });
  } catch (e) {
     
    console.error("[PATCH calendar event]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
