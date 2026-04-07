import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { appendActivityLog } from "../../../../../lib/deal-api/audit";
import { persistReadinessSnapshot } from "../../../../../lib/deal-api/persist-readiness";
import { dispatchDealAutomationTrigger } from "../../../../../lib/automation/dispatch";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { mergeWorkspaceMeta } from "../../../../../lib/deal-api/workspace-meta-merge";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";
import { syncNextStepReminderTask } from "../../../../../lib/deals/next-step-reminder-task";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";

type Ctx = { params: Promise<{ dealId: string }> };

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
    return NextResponse.json({ error: "Очікується об'єкт полів" }, { status: 400 });
  }

  const patch = body as Partial<DealWorkspaceMeta>;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true, workspaceMeta: true, status: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.DEALS_UPDATE, {
      ownerId: deal.ownerId,
    });
    if (denied) return denied;

    const sessionUserId = user.id;

    const nextMeta = mergeWorkspaceMeta(deal.workspaceMeta, patch);
    await prisma.deal.update({
      where: { id: dealId },
      data: { workspaceMeta: nextMeta },
    });

    await appendActivityLog({
      entityType: "DEAL",
      entityId: dealId,
      type: "DEAL_WORKSPACE_META_UPDATED",
      actorUserId: sessionUserId,
      data: { keys: Object.keys(patch) },
    });

    await persistReadinessSnapshot(dealId, sessionUserId);
    await dispatchDealAutomationTrigger({
      dealId,
      trigger: "DEAL_WORKSPACE_META_UPDATED",
      payload: { dealId, keys: Object.keys(patch) },
      startedById: sessionUserId,
    });

    await syncNextStepReminderTask({
      dealId,
      ownerId: deal.ownerId,
      dealStatus: deal.status,
      workspaceMetaJson: nextMeta,
      actorUserId: sessionUserId,
    });
    const nextStepKind =
      typeof nextMeta === "object" && nextMeta && !Array.isArray(nextMeta)
        ? (nextMeta as Partial<DealWorkspaceMeta>).nextStepKind
        : undefined;
    const nextActionAt =
      typeof nextMeta === "object" && nextMeta && !Array.isArray(nextMeta)
        ? (nextMeta as Partial<DealWorkspaceMeta>).nextActionAt
        : undefined;
    const followUpDate =
      typeof nextActionAt === "string" ? new Date(nextActionAt) : null;
    const shouldEmitFollowUp =
      nextStepKind === "follow_up" &&
      (!followUpDate ||
        Number.isNaN(followUpDate.getTime()) ||
        followUpDate.getTime() <= Date.now());
    if (shouldEmitFollowUp) {
      const dayKey = new Date().toISOString().slice(0, 10);
      await recordWorkflowEvent(
        WORKFLOW_EVENT_TYPES.FOLLOW_UP_REQUIRED,
        { dealId },
        {
          entityType: "DEAL",
          entityId: dealId,
          dealId,
          userId: sessionUserId,
          dedupeKey: `follow-up:${dealId}:${dayKey}`,
        },
      );
    }

    revalidatePath(`/deals/${dealId}/workspace`);
    revalidatePath("/tasks");
    revalidatePath("/tasks/today");
    revalidatePath("/today");
    return NextResponse.json({ ok: true, workspaceMeta: nextMeta });
  } catch (e) {
     
    console.error("[PATCH workspace-meta]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
