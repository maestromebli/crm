import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";

/** Огляд каталогу для бібліотеки (доступ за REPORTS_VIEW). */
export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.REPORTS_VIEW);
  if (denied) return denied;

  const providers = await prisma.materialProvider.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json({
    providers: providers.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      isActive: p.isActive,
      itemsCount: p._count.items,
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}
