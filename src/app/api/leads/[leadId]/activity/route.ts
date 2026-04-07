import { NextResponse } from "next/server";
import type { ActivityType } from "@prisma/client";
import { prisma } from "../../../../../lib/prisma";
import {
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import {
  leadActivityCategory,
  leadActivityDetail,
  leadActivityHeadline,
} from "../../../../../lib/leads/lead-activity-display";

type Ctx = { params: Promise<{ leadId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { leadId } = await ctx.params;

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

    return NextResponse.json({
      items: rows.map((r) => {
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
      }),
    });
  } catch (e) {
     
    console.error("[GET leads/[leadId]/activity]", e);
    return NextResponse.json(
      { error: "Помилка завантаження" },
      { status: 500 },
    );
  }
}
