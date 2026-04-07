import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { CalendarEventType } from "@prisma/client";
import { forbidUnlessPermission, requireSessionUser } from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { canAccessOwner, resolveAccessContext } from "../../../../lib/authz/data-scope";
import { prisma } from "../../../../lib/prisma";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";

const TYPES: CalendarEventType[] = [
  "MEETING",
  "MEASUREMENT",
  "INSTALLATION",
  "DELIVERY",
  "OTHER",
];

function isType(v: string): v is CalendarEventType {
  return TYPES.includes(v as CalendarEventType);
}

export async function POST(req: Request) {
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

  const userId = user.id;

  let body: {
    title?: string;
    description?: string | null;
    type?: string;
    startAt?: string;
    endAt?: string;
    isAllDay?: boolean;
    location?: string | null;
    leadId?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Вкажіть назву події" }, { status: 400 });
  }

  if (!body.type || !isType(body.type)) {
    return NextResponse.json({ error: "Некоректний тип події" }, { status: 400 });
  }

  const startAt =
    typeof body.startAt === "string" ? new Date(body.startAt) : null;
  const endAt = typeof body.endAt === "string" ? new Date(body.endAt) : null;
  if (!startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return NextResponse.json(
      { error: "Некоректний час початку або завершення" },
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
    const leadId =
      typeof body.leadId === "string" && body.leadId.trim()
        ? body.leadId.trim()
        : null;
    if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, ownerId: true },
      });
      if (!lead) {
        return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
      }
      const accessCtx = await resolveAccessContext(prisma, user);
      if (!canAccessOwner(accessCtx, lead.ownerId)) {
        return NextResponse.json(
          { error: "Немає прав прив'язувати подію до цього ліда" },
          { status: 403 },
        );
      }
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title,
        description:
          typeof body.description === "string" ? body.description.trim() || null : null,
        type: body.type,
        status: "PLANNED",
        startAt,
        endAt,
        isAllDay: Boolean(body.isAllDay),
        location:
          typeof body.location === "string" ? body.location.trim() || null : null,
        leadId,
        createdById: userId,
        assignedToId: userId,
      },
      select: { id: true },
    });
    if (body.type === "MEASUREMENT" && leadId) {
      await recordWorkflowEvent(
        WORKFLOW_EVENT_TYPES.MEASUREMENT_SCHEDULED,
        { leadId, eventId: event.id },
        {
          entityType: "LEAD",
          entityId: leadId,
          userId,
          dedupeKey: `measurement-scheduled:${event.id}`,
        },
      );
    }

    revalidatePath("/calendar");
    revalidatePath("/calendar", "layout");
    return NextResponse.json({ ok: true, id: event.id });
  } catch (e) {
     
    console.error("[POST calendar/events]", e);
    return NextResponse.json({ error: "Не вдалося створити подію" }, { status: 500 });
  }
}
