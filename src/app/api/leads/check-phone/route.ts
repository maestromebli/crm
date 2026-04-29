import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import {
  ownerIdWhere,
  resolveAccessContext,
} from "../../../../lib/authz/data-scope";
import { prisma } from "../../../../lib/prisma";
import type { PhoneDuplicateMatch } from "../../../../lib/leads/phone-check-matches";
import {
  normalizePhoneDigits,
  phonesLikelySame,
} from "../../../../lib/leads/phone-normalize";
import { requireRouteRateLimit } from "@/lib/api/rate-limit";

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

  const rateLimited = await requireRouteRateLimit({
    action: "leads:check-phone",
    subject: { type: "user", value: user.id },
    maxRequests: 120,
    windowMinutes: 5,
  });
  if (rateLimited) return rateLimited;

  const url = new URL(req.url);
  const raw = url.searchParams.get("phone")?.trim() ?? "";
  const normalizedRaw = normalizePhoneDigits(raw);
  if (normalizedRaw.length < 5) {
    return NextResponse.json({ matches: [] });
  }
  const phoneTail10 = normalizedRaw.slice(-10);
  const phoneTail9 = normalizedRaw.slice(-9);

  const ctx = await resolveAccessContext(prisma, {
    id: user.id,
    role: user.dbRole,
  });
  const ownerWhere = ownerIdWhere(ctx);
  const ownerIds = ownerWhere?.in ?? null;

  try {
    const ownerFilterSql = ownerIds?.length
      ? Prisma.sql`AND "ownerId" IN (${Prisma.join(ownerIds)})`
      : Prisma.empty;

    const [leadRows, contactRows, deals] = await Promise.all([
      prisma.$queryRaw<
        Array<{ id: string; title: string; phone: string | null; ownerId: string }>
      >(Prisma.sql`
        SELECT id, title, phone, "ownerId"
        FROM "Lead"
        WHERE phone IS NOT NULL
          ${ownerFilterSql}
          AND (
            right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${phoneTail10}
            OR right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ${phoneTail9}
          )
        ORDER BY "updatedAt" DESC
        LIMIT 250
      `),
      prisma.$queryRaw<Array<{ id: string; fullName: string | null; phone: string | null }>>(
        Prisma.sql`
          SELECT DISTINCT c.id, c."fullName", c.phone
          FROM "Contact" c
          LEFT JOIN "Lead" l ON l."contactId" = c.id
          LEFT JOIN "Deal" d ON d."primaryContactId" = c.id
          WHERE c.phone IS NOT NULL
            AND (
              right(regexp_replace(c.phone, '[^0-9]', '', 'g'), 10) = ${phoneTail10}
              OR right(regexp_replace(c.phone, '[^0-9]', '', 'g'), 9) = ${phoneTail9}
            )
            ${ownerIds?.length
              ? Prisma.sql`AND (l."ownerId" IN (${Prisma.join(ownerIds)}) OR d."ownerId" IN (${Prisma.join(ownerIds)}))`
              : Prisma.empty}
          LIMIT 250
        `,
      ),
      prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          value: number | null;
          currency: string | null;
          ownerId: string;
          primaryPhone: string | null;
          primaryFullName: string | null;
        }>
      >(Prisma.sql`
        SELECT d.id, d.title, d.value, d.currency, d."ownerId",
               pc.phone AS "primaryPhone",
               pc."fullName" AS "primaryFullName"
        FROM "Deal" d
        LEFT JOIN "Contact" pc ON pc.id = d."primaryContactId"
        WHERE d.status = 'OPEN'
          ${ownerFilterSql}
          AND pc.phone IS NOT NULL
          AND (
            right(regexp_replace(pc.phone, '[^0-9]', '', 'g'), 10) = ${phoneTail10}
            OR right(regexp_replace(pc.phone, '[^0-9]', '', 'g'), 9) = ${phoneTail9}
          )
        ORDER BY d."updatedAt" DESC
        LIMIT 250
      `),
    ]);

    const leadMatches = leadRows.filter((l) =>
      phonesLikelySame(l.phone ?? "", raw),
    );
    const contactMatches = contactRows.filter((c) =>
      phonesLikelySame(c.phone ?? "", raw),
    );
    const dealMatches = deals.filter((d) =>
      phonesLikelySame(d.primaryPhone ?? "", raw),
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
        const contactName = d.primaryFullName?.trim();
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
