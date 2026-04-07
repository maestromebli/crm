import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { requireDatabaseUrl } from "@/lib/api/route-guards";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ dealId: string }> };

/**
 * Проєкти без угоди — для прив’язки до поточної угоди з робочого місця.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { ownerId: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
    if (denied) return denied;

    const url = new URL(_req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";

    const projects = await prisma.project.findMany({
      where: {
        dealId: null,
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { title: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      take: 40,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
      },
    });

    return NextResponse.json({ projects });
  } catch {
    return NextResponse.json(
      { error: "Не вдалося завантажити проєкти" },
      { status: 500 },
    );
  }
}
