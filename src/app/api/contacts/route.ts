import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../lib/authz/api-guard";
import { P } from "../../../lib/authz/permissions";
import { ownerIdWhere, resolveAccessContext } from "../../../lib/authz/data-scope";

/**
 * Пошук контактів для привʼязки до ліда (q у fullName / phone / email).
 */
export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  try {
    const rows = await prisma.contact.findMany({
      where: {
        AND: [
          {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          ...(ownerWhere
            ? [
                {
                  OR: [
                    { leads: { some: { ownerId: ownerWhere } } },
                    { deals: { some: { ownerId: ownerWhere } } },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
      },
    });

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        phone: r.phone,
        email: r.email,
      })),
    });
  } catch (e) {
     
    console.error("[GET /api/contacts]", e);
    return NextResponse.json(
      { error: "Помилка пошуку" },
      { status: 500 },
    );
  }
}
