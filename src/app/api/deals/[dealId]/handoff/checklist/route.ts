import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mergeWorkspaceMeta } from "@/lib/deal-api/workspace-meta-merge";
import { persistReadinessSnapshot } from "@/lib/deal-api/persist-readiness";
import { appendActivityLog } from "@/lib/deal-api/audit";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";

type Ctx = { params: Promise<{ dealId: string }> };

async function ensureHandoff(dealId: string) {
  return prisma.dealHandoff.upsert({
    where: { dealId },
    create: { dealId },
    update: {},
  });
}

async function completionForHandoff(handoffId: string) {
  const [requiredCount, checkedRequiredCount, totalCount] = await Promise.all([
    prisma.dealHandoffChecklistItem.count({
      where: { handoffId, isRequired: true },
    }),
    prisma.dealHandoffChecklistItem.count({
      where: { handoffId, isRequired: true, isChecked: true },
    }),
    prisma.dealHandoffChecklistItem.count({
      where: { handoffId },
    }),
  ]);
  return {
    requiredCount,
    checkedRequiredCount,
    totalCount,
    complete: requiredCount > 0 && checkedRequiredCount >= requiredCount,
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { dealId } = await ctx.params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
  if (denied) return denied;

  const handoff = await ensureHandoff(dealId);
  const [items, completion] = await Promise.all([
    prisma.dealHandoffChecklistItem.findMany({
      where: { handoffId: handoff.id },
      orderBy: [{ isRequired: "desc" }, { createdAt: "asc" }],
    }),
    completionForHandoff(handoff.id),
  ]);

  return NextResponse.json({
    handoffId: handoff.id,
    status: handoff.status,
    items: items.map((item) => ({
      id: item.id,
      code: item.code,
      title: item.title,
      isRequired: item.isRequired,
      isChecked: item.isChecked,
      checkedById: item.checkedById,
      checkedAt: item.checkedAt?.toISOString() ?? null,
      note: item.note,
      updatedAt: item.updatedAt.toISOString(),
    })),
    completion,
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { dealId } = await ctx.params;

  let body: {
    items?: Array<{
      id?: string;
      code?: string;
      title?: string;
      isRequired?: boolean;
      isChecked?: boolean;
      note?: string | null;
    }>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "Очікується items[] для оновлення checklist." },
      { status: 400 },
    );
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, ownerId: true, workspaceMeta: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }
  const denied = await forbidUnlessDealAccess(user, P.DEALS_UPDATE, deal);
  if (denied) return denied;

  const handoff = await ensureHandoff(dealId);

  for (const item of body.items) {
    const now = new Date();
    const isChecked = item.isChecked === true;
    const payload = {
      code: typeof item.code === "string" ? item.code.trim().slice(0, 100) : "",
      title:
        typeof item.title === "string" ? item.title.trim().slice(0, 400) : "",
      isRequired: item.isRequired !== false,
      isChecked,
      checkedById: isChecked ? user.id : null,
      checkedAt: isChecked ? now : null,
      note:
        item.note === null
          ? null
          : typeof item.note === "string"
            ? item.note.trim().slice(0, 5000)
            : null,
    };

    if (item.id && item.id.trim()) {
      await prisma.dealHandoffChecklistItem.updateMany({
        where: { id: item.id, handoffId: handoff.id },
        data: {
          isRequired: payload.isRequired,
          isChecked: payload.isChecked,
          checkedById: payload.checkedById,
          checkedAt: payload.checkedAt,
          note: payload.note,
          ...(payload.code ? { code: payload.code } : {}),
          ...(payload.title ? { title: payload.title } : {}),
        },
      });
      continue;
    }

    if (!payload.code || !payload.title) {
      return NextResponse.json(
        { error: "Для створення checklist item потрібні code і title." },
        { status: 400 },
      );
    }
    await prisma.dealHandoffChecklistItem.create({
      data: {
        handoffId: handoff.id,
        code: payload.code,
        title: payload.title,
        isRequired: payload.isRequired,
        isChecked: payload.isChecked,
        checkedById: payload.checkedById,
        checkedAt: payload.checkedAt,
        note: payload.note,
      },
    });
  }

  const completion = await completionForHandoff(handoff.id);
  const nextMeta = mergeWorkspaceMeta(deal.workspaceMeta, {
    handoffGate: {
      checklistCompleted: completion.complete,
      reviewedByUserId: user.id,
      reviewedAt: new Date().toISOString(),
    },
  });
  await prisma.deal.update({
    where: { id: dealId },
    data: { workspaceMeta: nextMeta },
  });
  await appendActivityLog({
    entityType: "DEAL",
    entityId: dealId,
    type: "DEAL_WORKSPACE_META_UPDATED",
    actorUserId: user.id,
    data: {
      handoffChecklistUpdated: true,
      complete: completion.complete,
    },
  });
  await persistReadinessSnapshot(dealId, user.id);

  revalidatePath(`/deals/${dealId}/workspace`);
  revalidatePath("/production");

  return NextResponse.json({ ok: true, completion });
}
