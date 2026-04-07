import type {
  CalendarEventStatus as PrismaCalStatus,
  CalendarEventType as PrismaCalType,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AccessContext } from "../../lib/authz/data-scope";
import { calendarEventWhere } from "../../lib/authz/data-scope";
import type { CalendarEvent, CalendarEventStatus, CalendarEventType } from "./types";

const prismaTypeToUi: Record<PrismaCalType, CalendarEventType> = {
  MEETING: "meeting",
  MEASUREMENT: "measurement",
  INSTALLATION: "installation",
  DELIVERY: "delivery",
  OTHER: "internal",
};

const prismaStatusToUi: Record<PrismaCalStatus, CalendarEventStatus> = {
  PLANNED: "planned",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELED: "canceled",
};

export function mapDbCalendarEvent(row: {
  id: string;
  title: string;
  description: string | null;
  type: PrismaCalType;
  status: PrismaCalStatus;
  startAt: Date;
  endAt: Date;
  isAllDay: boolean;
  location: string | null;
  createdById: string;
  assignedToId: string | null;
  assignedTo: { name: string | null; email: string } | null;
}): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    type: prismaTypeToUi[row.type],
    status: prismaStatusToUi[row.status],
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    allDay: row.isAllDay,
    location: row.location ?? undefined,
    notes: row.description ?? undefined,
    assigneeName: row.assignedTo
      ? row.assignedTo.name ?? row.assignedTo.email
      : undefined,
    createdById: row.createdById,
    assignedToId: row.assignedToId,
  };
}

/** Події з PostgreSQL для календаря (останні та майбутні, обмеження обсягу). */
export async function loadCalendarEventsFromDb(
  ctx: AccessContext,
): Promise<CalendarEvent[]> {
  if (!process.env.DATABASE_URL?.trim()) return [];
  try {
    const scope = calendarEventWhere(ctx);
    const rows = await prisma.calendarEvent.findMany({
      orderBy: { startAt: "asc" },
      take: 800,
      ...(scope ? { where: scope } : {}),
      include: {
        assignedTo: { select: { name: true, email: true } },
      },
    });
    return rows.map((r) =>
      mapDbCalendarEvent({
        id: r.id,
        title: r.title,
        description: r.description,
        type: r.type,
        status: r.status,
        startAt: r.startAt,
        endAt: r.endAt,
        isAllDay: r.isAllDay,
        location: r.location,
        createdById: r.createdById,
        assignedToId: r.assignedToId,
        assignedTo: r.assignedTo,
      }),
    );
  } catch {
    return [];
  }
}
