import { NextResponse } from "next/server";
import type { ActivityType } from "@prisma/client";
import { prisma } from "../../../../../lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { ownerIdWhere, resolveAccessContext } from "../../../../../lib/authz/data-scope";
import {
  leadActivityCategory,
  leadActivityDetail,
  leadActivityHeadline,
} from "../../../../../lib/leads/lead-activity-display";

type Ctx = { params: Promise<{ contactId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.CONTACTS_VIEW);
  if (denied) return denied;
  const access = await resolveAccessContext(prisma, {
    id: user.id,
    role: user.dbRole,
  });
  const ownerWhere = ownerIdWhere(access);

  const { contactId } = await ctx.params;

  try {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
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
      return NextResponse.json({ error: "Контакт не знайдено" }, { status: 404 });
    }

    const rows = await prisma.activityLog.findMany({
      where: { entityType: "CONTACT", entityId: contactId },
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
     
    console.error("[GET contacts/[contactId]/activity]", e);
    return NextResponse.json(
      { error: "Помилка завантаження" },
      { status: 500 },
    );
  }
}
