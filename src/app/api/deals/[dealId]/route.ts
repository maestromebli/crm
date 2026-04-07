import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { DealStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendActivityLog } from "@/lib/deal-api/audit";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { requireDatabaseUrl } from "@/lib/api/route-guards";

const DEAL_STATUSES: DealStatus[] = ["OPEN", "WON", "LOST", "ON_HOLD"];

type Ctx = { params: Promise<{ dealId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const data: {
    title?: string;
    description?: string | null;
    value?: number | null;
    currency?: string | null;
    expectedCloseDate?: string | null;
    status?: DealStatus;
  } = {};

  if (typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim();
  }
  if (body.description === null || typeof body.description === "string") {
    data.description =
      body.description === null ? null : String(body.description);
  }
  if (body.value === null) {
    data.value = null;
  } else if (typeof body.value === "number" && Number.isFinite(body.value)) {
    data.value = body.value;
  }
  if (body.currency === null || typeof body.currency === "string") {
    data.currency =
      body.currency === null ? null : String(body.currency).trim() || null;
  }
  if (body.expectedCloseDate === null || body.expectedCloseDate === "") {
    data.expectedCloseDate = null;
  } else if (typeof body.expectedCloseDate === "string") {
    const d = new Date(body.expectedCloseDate);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "Некоректна дата закриття" },
        { status: 400 },
      );
    }
    data.expectedCloseDate = d.toISOString();
  }
  if (typeof body.status === "string") {
    if (!DEAL_STATUSES.includes(body.status as DealStatus)) {
      return NextResponse.json({ error: "Некоректний статус" }, { status: 400 });
    }
    data.status = body.status as DealStatus;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Немає полів для оновлення" },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.DEALS_UPDATE, {
      ownerId: existing.ownerId,
    });
    if (denied) return denied;

    const userId = user.id;

    const prismaData: {
      title?: string;
      description?: string | null;
      value?: number | null;
      currency?: string | null;
      expectedCloseDate?: Date | null;
      status?: DealStatus;
    } = {};
    if (data.title !== undefined) prismaData.title = data.title;
    if (data.description !== undefined) prismaData.description = data.description;
    if (data.value !== undefined) prismaData.value = data.value;
    if (data.currency !== undefined) prismaData.currency = data.currency;
    if (data.expectedCloseDate !== undefined) {
      prismaData.expectedCloseDate =
        data.expectedCloseDate === null
          ? null
          : new Date(data.expectedCloseDate);
    }
    if (data.status !== undefined) prismaData.status = data.status;

    await prisma.deal.update({
      where: { id: dealId },
      data: prismaData,
    });

    await appendActivityLog({
      entityType: "DEAL",
      entityId: dealId,
      type: "DEAL_UPDATED",
      actorUserId: userId,
      data: { fields: Object.keys(prismaData) },
    });

    revalidatePath(`/deals/${dealId}/workspace`);
    return NextResponse.json({ ok: true });
  } catch (e) {
     
    console.error("[PATCH deal]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
