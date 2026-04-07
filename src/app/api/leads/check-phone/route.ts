import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import {
  ownerIdWhere,
  canAccessOwner,
  resolveAccessContext,
} from "../../../../lib/authz/data-scope";
import { prisma } from "../../../../lib/prisma";
import type { PhoneDuplicateMatch } from "../../../../lib/leads/phone-check-matches";
import { phonesLikelySame } from "../../../../lib/leads/phone-normalize";

export async function GET(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.LEADS_VIEW);
  if (denied) return denied;

  const url = new URL(req.url);
  const raw = url.searchParams.get("phone")?.trim() ?? "";
  if (raw.length < 5) {
    return NextResponse.json({
      matches: { leads: [], contacts: [], deals: [] },
    });
  }

  const ctx = await resolveAccessContext(prisma, {
    id: user.id,
    role: user.dbRole,
  });
  const ownerWhere = ownerIdWhere(ctx);

  try {
    const [leadRows, contactRows, deals] = await Promise.all([
      prisma.lead.findMany({
        where: {
          phone: { not: null },
          ...(ownerWhere ? { ownerId: ownerWhere } : {}),
        },
        select: {
          id: true,
          title: true,
          phone: true,
          stage: { select: { name: true } },
          ownerId: true,
        },
        take: 400,
      }),
      prisma.contact.findMany({
        where: {
          phone: { not: null },
          ...(ownerWhere
            ? {
                OR: [
                  { leads: { some: { ownerId: ownerWhere } } },
                  { deals: { some: { ownerId: ownerWhere } } },
                ],
              }
            : {}),
        },
        select: { id: true, fullName: true, phone: true },
        take: 400,
      }),
      prisma.deal.findMany({
        where: {
          status: "OPEN",
          ...(ownerWhere ? { ownerId: ownerWhere } : {}),
        },
        select: {
          id: true,
          title: true,
          value: true,
          currency: true,
          ownerId: true,
          primaryContact: { select: { phone: true, fullName: true } },
        },
        take: 400,
      }),
    ]);

    const leadMatches = leadRows.filter(
      (l) =>
        phonesLikelySame(l.phone ?? "", raw) && canAccessOwner(ctx, l.ownerId),
    );
    const contactMatches = contactRows.filter((c) =>
      phonesLikelySame(c.phone ?? "", raw),
    );
    const dealMatches = deals.filter(
      (d) =>
        phonesLikelySame(d.primaryContact?.phone ?? "", raw) &&
        canAccessOwner(ctx, d.ownerId),
    );

    const matches: PhoneDuplicateMatch[] = [
      ...leadMatches.map((l) => ({
        type: "lead" as const,
        id: l.id,
        name: l.title,
        value: null,
      })),
      ...contactMatches.map((c) => ({
        type: "contact" as const,
        id: c.id,
        name: c.fullName,
        value: null,
      })),
      ...dealMatches.map((d) => {
        const contactName = d.primaryContact?.fullName?.trim();
        return {
          type: "deal" as const,
          id: d.id,
          name: contactName || d.title,
          value: d.value != null ? Number(d.value) : null,
          currency: d.currency ?? null,
        };
      }),
    ];

    return NextResponse.json({ matches });
  } catch (e) {
     
    console.error("[GET /api/leads/check-phone]", e);
    return NextResponse.json(
      { error: "Помилка перевірки" },
      { status: 500 },
    );
  }
}
