import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../../../lib/prisma";
import { appendActivityLog } from "../../../../../lib/deal-api/audit";
import { persistReadinessSnapshot } from "../../../../../lib/deal-api/persist-readiness";
import {
  emptyControlMeasurement,
  parseDealControlMeasurement,
  type DealControlMeasurementV1,
} from "../../../../../lib/deals/control-measurement";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";

type Ctx = { params: Promise<{ dealId: string }> };

function mergeMeasurement(
  existing: Prisma.JsonValue | null,
  patch: Partial<DealControlMeasurementV1>,
): Prisma.InputJsonValue {
  const cur =
    parseDealControlMeasurement(existing) ?? emptyControlMeasurement();
  const next: DealControlMeasurementV1 = {
    ...cur,
    ...patch,
    schema: "deal_control_measurement_v1",
    attachmentIds:
      patch.attachmentIds !== undefined
        ? patch.attachmentIds
        : cur.attachmentIds,
  };
  return next as unknown as Prisma.InputJsonValue;
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Очікується об'єкт" }, { status: 400 });
  }
  const patch = body as Partial<DealControlMeasurementV1>;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true, controlMeasurementJson: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.DEALS_UPDATE, {
      ownerId: deal.ownerId,
    });
    if (denied) return denied;

    const nextJson = mergeMeasurement(deal.controlMeasurementJson, patch);

    await prisma.deal.update({
      where: { id: dealId },
      data: { controlMeasurementJson: nextJson },
    });

    await appendActivityLog({
      entityType: "DEAL",
      entityId: dealId,
      type: "DEAL_WORKSPACE_META_UPDATED",
      actorUserId: user.id,
      data: { controlMeasurementUpdated: true },
    });

    await persistReadinessSnapshot(dealId, user.id);

    revalidatePath(`/deals/${dealId}/workspace`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PATCH control-measurement]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
