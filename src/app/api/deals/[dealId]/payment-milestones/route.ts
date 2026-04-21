import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { appendActivityLog } from "../../../../../lib/deal-api/audit";
import { mergeWorkspaceMeta } from "../../../../../lib/deal-api/workspace-meta-merge";
import { persistReadinessSnapshot } from "../../../../../lib/deal-api/persist-readiness";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import type { PaymentPlanStepJson } from "../../../../../lib/deals/payment-milestones";

type Ctx = { params: Promise<{ dealId: string }> };

function parseMeta(raw: unknown): DealWorkspaceMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DealWorkspaceMeta;
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
  const milestoneId =
    typeof (body as { milestoneId?: unknown }).milestoneId === "string"
      ? (body as { milestoneId: string }).milestoneId.trim()
      : "";
  const confirmed = (body as { confirmed?: unknown }).confirmed === true;
  if (!milestoneId) {
    return NextResponse.json({ error: "milestoneId обов'язковий" }, { status: 400 });
  }

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true, workspaceMeta: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.DEALS_UPDATE, {
      ownerId: deal.ownerId,
    });
    if (denied) return denied;

    const plan = await prisma.dealPaymentPlan.findUnique({
      where: { dealId },
    });
    if (!plan) {
      return NextResponse.json(
        { error: "План оплат не знайдено — спочатку створіть графік." },
        { status: 404 },
      );
    }

    const m = /^pp-(\d+)$/.exec(milestoneId);
    const idx = m ? Number(m[1]) : -1;
    const raw = plan.stepsJson;
    if (!Array.isArray(raw) || idx < 0 || idx >= raw.length) {
      return NextResponse.json({ error: "Віху не знайдено" }, { status: 404 });
    }

    const next = raw.map((x, i) => {
      const step = { ...(x as PaymentPlanStepJson) };
      if (i !== idx) return step;
      if (confirmed) {
        step.status = "PAID";
        step.paidAt = new Date().toISOString();
      } else {
        step.status = "PENDING";
        step.paidAt = null;
      }
      return step;
    });

    await prisma.dealPaymentPlan.update({
      where: { dealId },
      data: { stepsJson: next },
    });

    const milestones = next.map((x, i) => {
      const s = x as PaymentPlanStepJson;
      return {
        id: `pp-${i}`,
        label: s.label?.trim() ? s.label.trim() : `Крок ${i + 1}`,
        amount: s.amount ?? undefined,
        currency: "UAH",
        done: s.status === "PAID",
      };
    });

    const nextMeta = mergeWorkspaceMeta(deal.workspaceMeta, {
      payment: { milestones },
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
      data: { paymentMilestoneId: milestoneId, confirmed },
    });

    await persistReadinessSnapshot(dealId, user.id);

    revalidatePath(`/deals/${dealId}/workspace`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PATCH payment-milestones]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
