import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { appendActivityLog } from "../../../../../../lib/deal-api/audit";
import { mergeWorkspaceMeta } from "../../../../../../lib/deal-api/workspace-meta-merge";
import { persistReadinessSnapshot } from "../../../../../../lib/deal-api/persist-readiness";
import {
  seedDealPaymentPlan7030,
  type PaymentPlanStepJson,
} from "../../../../../../lib/deals/payment-milestones";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";

type Ctx = { params: Promise<{ dealId: string }> };

function parseMeta(raw: unknown): DealWorkspaceMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DealWorkspaceMeta;
}

type Split = { percent: number; label: string };

export async function POST(req: Request, ctx: Ctx) {
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
  const reason =
    typeof (body as { reason?: unknown }).reason === "string"
      ? (body as { reason: string }).reason.trim()
      : "";
  if (reason.length < 8) {
    return NextResponse.json(
      { error: "Вкажіть причину зміни графіку (мінімум 8 символів)." },
      { status: 400 },
    );
  }

  const splitsRaw = (body as { splits?: unknown }).splits;
  const splits: Split[] | null = Array.isArray(splitsRaw)
    ? splitsRaw
        .map((x) => {
          if (!x || typeof x !== "object" || Array.isArray(x)) return null;
          const o = x as Record<string, unknown>;
          const percent =
            typeof o.percent === "number" ? o.percent : Number(o.percent);
          const label = typeof o.label === "string" ? o.label.trim() : "";
          if (!Number.isFinite(percent) || percent <= 0 || !label) return null;
          return { percent, label };
        })
        .filter((x): x is Split => x != null)
    : null;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        ownerId: true,
        value: true,
        currency: true,
        workspaceMeta: true,
      },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.DEALS_UPDATE, {
      ownerId: deal.ownerId,
    });
    if (denied) return denied;

    const total = deal.value;
    const currency = deal.currency?.trim() || "UAH";
    if (total == null || total <= 0) {
      return NextResponse.json(
        { error: "Спочатку задайте суму угоди." },
        { status: 400 },
      );
    }

    let payment: NonNullable<DealWorkspaceMeta["payment"]>;

    if (splits && splits.length > 0) {
      const sumPct = splits.reduce((a, b) => a + b.percent, 0);
      if (Math.abs(sumPct - 100) > 0.01) {
        return NextResponse.json(
          { error: "Сума відсотків має бути 100%." },
          { status: 400 },
        );
      }
      const steps: PaymentPlanStepJson[] = splits.map((s) => {
        const amt = Math.round(total * (s.percent / 100) * 100) / 100;
        return {
          percent: s.percent,
          amount: amt,
          label: `${s.label} (${s.percent}%)`,
          status: "PENDING",
          dueDate: null,
          paidAt: null,
        };
      });
      await prisma.dealPaymentPlan.upsert({
        where: { dealId },
        create: {
          dealId,
          stepsJson: steps,
          reasonIfChanged: reason,
        },
        update: {
          stepsJson: steps,
          reasonIfChanged: reason,
        },
      });
      payment = {
        milestones: steps.map((st, i) => ({
          id: `pp-${i}`,
          label: st.label,
          amount: st.amount,
          currency,
          done: false,
        })),
      };
    } else {
      payment = await seedDealPaymentPlan7030(prisma, {
        dealId,
        total,
        currency,
      });
    }

    const meta = parseMeta(deal.workspaceMeta);
    const log = meta.paymentPlanChangeLog ?? [];
    const nextMeta = mergeWorkspaceMeta(deal.workspaceMeta, {
      payment,
      paymentPlanChangeLog: [
        ...log,
        {
          at: new Date().toISOString(),
          reason,
          userId: user.id,
        },
      ],
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
      data: { paymentPlanReplanned: true },
    });

    await persistReadinessSnapshot(dealId, user.id);

    revalidatePath(`/deals/${dealId}/workspace`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST payment-milestones/replan]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
