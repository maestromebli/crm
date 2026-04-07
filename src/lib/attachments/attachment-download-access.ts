import type { AttachmentEntityType } from "@prisma/client";
import { NextResponse } from "next/server";
import type { SessionUser } from "../authz/api-guard";
import {
  forbidUnlessDealAccess,
  forbidUnlessLeadAccess,
  forbidUnlessPermission,
} from "../authz/api-guard";
import {
  canAccessOwner,
  canAccessCalendarEvent,
  ownerIdWhere,
  resolveAccessContext,
} from "../authz/data-scope";
import { P } from "../authz/permissions";
import { prisma } from "../prisma";

/**
 * Перевірка права на читання вкладення (завантаження файлу).
 */
export async function forbidUnlessAttachmentReadAccess(
  user: SessionUser,
  att: {
    entityType: AttachmentEntityType;
    entityId: string;
  },
): Promise<NextResponse | null> {
  const perm = forbidUnlessPermission(user, P.FILES_VIEW);
  if (perm) return perm;

  switch (att.entityType) {
    case "LEAD": {
      const lead = await prisma.lead.findUnique({
        where: { id: att.entityId },
        select: { id: true, ownerId: true },
      });
      if (!lead) {
        return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
      }
      return forbidUnlessLeadAccess(user, P.FILES_VIEW, lead);
    }
    case "DEAL": {
      const deal = await prisma.deal.findUnique({
        where: { id: att.entityId },
        select: { id: true, ownerId: true },
      });
      if (!deal) {
        return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
      }
      return forbidUnlessDealAccess(user, P.FILES_VIEW, deal);
    }
    case "CONTACT": {
      const accessCtx = await resolveAccessContext(prisma, user);
      const ownerWhere = ownerIdWhere(accessCtx);
      const contact = await prisma.contact.findFirst({
        where: {
          id: att.entityId,
          ...(ownerWhere
            ? {
                OR: [
                  { leads: { some: { ownerId: ownerWhere } } },
                  { deals: { some: { ownerId: ownerWhere } } },
                ],
              }
            : {}),
        },
        select: { id: true },
      });
      if (!contact) {
        return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
      }
      return null;
    }
    case "CLIENT": {
      const accessCtx = await resolveAccessContext(prisma, user);
      const ownerWhere = ownerIdWhere(accessCtx);
      const client = await prisma.client.findFirst({
        where: {
          id: att.entityId,
          ...(ownerWhere
            ? {
                OR: [
                  { leads: { some: { ownerId: ownerWhere } } },
                  { deals: { some: { ownerId: ownerWhere } } },
                  {
                    orders: {
                      some: {
                        OR: [
                          { managerId: ownerWhere },
                          { deal: { is: { ownerId: ownerWhere } } },
                        ],
                      },
                    },
                  },
                ],
              }
            : {}),
        },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
      }
      return null;
    }
    case "ORDER": {
      const order = await prisma.order.findUnique({
        where: { id: att.entityId },
        select: {
          id: true,
          managerId: true,
          deal: { select: { ownerId: true } },
        },
      });
      if (!order) {
        return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
      }
      if (order.deal) {
        return forbidUnlessDealAccess(user, P.FILES_VIEW, order.deal);
      }
      if (order.managerId) {
        const accessCtx = await resolveAccessContext(prisma, user);
        if (!canAccessOwner(accessCtx, order.managerId)) {
          return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
        }
      }
      return null;
    }
    case "TASK": {
      const task = await prisma.task.findUnique({
        where: { id: att.entityId },
        select: { entityType: true, entityId: true },
      });
      if (!task) {
        return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
      }
      if (task.entityType === "DEAL") {
        const deal = await prisma.deal.findUnique({
          where: { id: task.entityId },
          select: { ownerId: true },
        });
        if (!deal) {
          return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
        }
        return forbidUnlessDealAccess(user, P.FILES_VIEW, deal);
      }
      const lead = await prisma.lead.findUnique({
        where: { id: task.entityId },
        select: { id: true, ownerId: true },
      });
      if (!lead) {
        return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
      }
      return forbidUnlessLeadAccess(user, P.FILES_VIEW, lead);
    }
    case "HANDOFF": {
      const handoff = await prisma.dealHandoff.findFirst({
        where: {
          OR: [{ id: att.entityId }, { dealId: att.entityId }],
        },
        select: { deal: { select: { ownerId: true } } },
      });
      if (!handoff?.deal) {
        return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
      }
      return forbidUnlessDealAccess(user, P.FILES_VIEW, handoff.deal);
    }
    case "EVENT": {
      const event = await prisma.calendarEvent.findUnique({
        where: { id: att.entityId },
        select: {
          createdById: true,
          assignedToId: true,
          lead: { select: { ownerId: true } },
        },
      });
      if (!event) {
        return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
      }
      const accessCtx = await resolveAccessContext(prisma, user);
      if (
        !canAccessCalendarEvent(accessCtx, {
          createdById: event.createdById,
          assignedToId: event.assignedToId,
          lead: event.lead,
        })
      ) {
        return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
      }
      return null;
    }
    default: {
      // Fail closed: unknown entity type should never be downloadable by default.
      return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
    }
  }
}
