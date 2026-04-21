import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/authz/api-guard";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { requireDatabaseUrl } from "@/lib/api/route-guards";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ projectId: string }> };

async function gateDealUpdate(
  user: SessionUser,
  dealId: string | null,
): Promise<NextResponse | null> {
  if (!dealId) return null;
  const d = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true },
  });
  if (!d) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }
  return forbidUnlessDealAccess(user, P.DEALS_UPDATE, d);
}

/**
 * Оновлення полів фінансового проєкту. Зараз: прив’язка / відв’язка замовлення (`dealId`).
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  if (!("dealId" in body)) {
    return NextResponse.json(
      { error: "Очікується поле dealId (string | null)" },
      { status: 400 },
    );
  }

  const raw = body.dealId;
  const newDealId =
    raw === null || raw === ""
      ? null
      : typeof raw === "string"
        ? raw.trim() || null
        : undefined;

  if (newDealId === undefined) {
    return NextResponse.json(
      { error: "dealId має бути рядком або null" },
      { status: 400 },
    );
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, dealId: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Проєкт не знайдено" }, { status: 404 });
    }

    const prevDealId = project.dealId;
    if (prevDealId === newDealId) {
      return NextResponse.json({
        ok: true,
        project: { id: project.id, dealId: newDealId },
      });
    }

    const a = await gateDealUpdate(user, prevDealId);
    if (a) return a;
    const b = await gateDealUpdate(user, newDealId);
    if (b) return b;

    await prisma.project.update({
      where: { id: projectId },
      data: { dealId: newDealId },
    });

    return NextResponse.json({
      ok: true,
      project: { id: projectId, dealId: newDealId },
    });
  } catch {
    return NextResponse.json(
      { error: "Не вдалося оновити проєкт" },
      { status: 500 },
    );
  }
}
