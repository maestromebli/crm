import { NextResponse } from "next/server";
import type { ActivityType } from "@prisma/client";
import { prisma } from "../../../../../lib/prisma";
import {
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import {
  canonicalEventType,
  EVENT_FAMILIES,
  eventFamilyForType,
} from "../../../../../lib/events/event-catalog";
import {
  leadActivityCategory,
  leadActivityDetail,
  leadActivityHeadline,
} from "../../../../../lib/leads/lead-activity-display";

type Ctx = { params: Promise<{ leadId: string }> };

function isSchemaDriftError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  if (maybe.code === "P2021" || maybe.code === "P2022") return true;
  const msg = (maybe.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("column");
}

export async function GET(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { leadId } = await ctx.params;
  const category = new URL(req.url).searchParams.get("category");

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, ownerId: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessLeadAccess(user, P.LEADS_VIEW, lead);
    if (denied) return denied;

    const rows = await prisma.activityLog.findMany({
      where: { entityType: "LEAD", entityId: leadId },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        type: true,
        source: true,
        data: true,
        createdAt: true,
        actorUser: { select: { name: true, email: true } },
      },
    });
    let domainRowsIndexed: Array<{
      id: string;
      type: string;
      payload: unknown;
      createdAt: Date;
    }> = [];
    let domainRowsLegacy: Array<{
      id: string;
      type: string;
      payload: unknown;
      createdAt: Date;
    }> = [];
    try {
      domainRowsIndexed = await prisma.domainEvent.findMany({
        where: { entityType: "LEAD", entityId: leadId },
        orderBy: { createdAt: "desc" },
        take: 120,
        select: { id: true, type: true, payload: true, createdAt: true },
      });
      domainRowsLegacy = await prisma.domainEvent.findMany({
        where: { entityType: null },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, type: true, payload: true, createdAt: true },
      });
    } catch (domainError) {
      if (!isSchemaDriftError(domainError)) throw domainError;
      console.warn(
        "[GET leads/[leadId]/activity] domain events skipped due to schema drift",
      );
    }
    const seen = new Set<string>();
    const domainItems = [...domainRowsIndexed, ...domainRowsLegacy]
      .map((r) => {
        if (seen.has(r.id)) return null;
        seen.add(r.id);
        const data = (r.payload ?? {}) as Record<string, unknown>;
        if (data.entityType !== "LEAD" || data.entityId !== leadId) return null;
        const normalizedType = canonicalEventType(r.type);
        return {
          id: `ev_${r.id}`,
          type: normalizedType,
          headline: leadActivityHeadline("LEAD_UPDATED", r.payload) ?? normalizedType,
          detail: leadActivityDetail("LEAD_UPDATED", r.payload),
          category: eventFamilyForType(normalizedType),
          source: "domain_event",
          createdAt: r.createdAt.toISOString(),
          actor: null as string | null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    const combined = [...rows.map((r) => {
        const t = r.type as ActivityType;
        return {
          id: r.id,
          type: r.type,
          headline: leadActivityHeadline(t, r.data),
          detail: leadActivityDetail(t, r.data),
          category: leadActivityCategory(t, r.data),
          source: r.source,
          createdAt: r.createdAt.toISOString(),
          actor: r.actorUser
            ? (r.actorUser.name ?? r.actorUser.email)
            : null,
        };
      }), ...domainItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const isKnownCategory =
      category === EVENT_FAMILIES.LEAD ||
      category === EVENT_FAMILIES.DEAL ||
      category === EVENT_FAMILIES.PRODUCTION ||
      category === EVENT_FAMILIES.AI_AUTOMATION;
    const filtered =
      category && isKnownCategory ? combined.filter((x) => x.category === category) : combined;

    return NextResponse.json({ items: filtered });
  } catch (e) {
     
    console.error("[GET leads/[leadId]/activity]", e);
    return NextResponse.json(
      { error: "Помилка завантаження" },
      { status: 500 },
    );
  }
}
