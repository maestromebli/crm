import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireSessionUser,
  forbidUnlessPermission,
  forbidUnlessDealAccess,
  forbidUnlessLeadAccess,
} from "@/lib/authz/api-guard";
import {
  hasEffectivePermission,
  P,
  type Phase1Permission,
} from "@/lib/authz/permissions";
import {
  buildAiContextResult,
  executeAiAction,
  type AiAction,
  type AiContextName,
} from "@/lib/ai/contextual-engine";
import { recordContinuousLearningEvent } from "@/lib/ai/continuous-learning";
import { requireAiRateLimit } from "@/lib/ai/route-guard";
import { logAiEvent } from "@/lib/ai/log-ai-event";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  context: z.enum([
    "lead",
    "deal",
    "finance",
    "procurement",
    "production",
    "dashboard",
  ]),
  dealId: z.string().optional(),
  leadId: z.string().optional(),
  executeActions: z.boolean().optional(),
});

function requiredPermissionForAiAction(action: AiAction): Phase1Permission {
  switch (action.type) {
    case "createTask":
      return P.TASKS_CREATE;
    case "updateStage":
      return P.DEALS_STAGE_CHANGE;
    case "generateQuote":
      return P.QUOTES_CREATE;
    case "generateInvoice":
      return P.PAYMENTS_UPDATE;
    case "sendReminder":
      return P.DEALS_UPDATE;
    default:
      return P.AI_USE;
  }
}

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.AI_USE);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні дані" }, { status: 400 });
  }

  const { context, dealId, leadId, executeActions } = parsed.data as {
    context: AiContextName;
    dealId?: string;
    leadId?: string;
    executeActions?: boolean;
  };
  const limited = await requireAiRateLimit({
    userId: user.id,
    action: "ai_contextual_result",
    maxRequests: 20,
    windowMinutes: 10,
  });
  if (limited) return limited;

  if (leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, ownerId: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
    }
    const deniedLead = await forbidUnlessLeadAccess(user, P.LEADS_VIEW, lead);
    if (deniedLead) return deniedLead;
  }

  if (dealId) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
    }
    const deniedDeal = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
    if (deniedDeal) return deniedDeal;
  }

  const ai = await buildAiContextResult({ context, dealId, leadId });
  if (executeActions && dealId) {
    const permissionCtx = {
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    };
    for (const action of ai.actions) {
      const requiredPermission = requiredPermissionForAiAction(action);
      if (
        !hasEffectivePermission(
          user.permissionKeys,
          requiredPermission,
          permissionCtx,
        )
      ) {
        return NextResponse.json(
          {
            error: `Недостатньо прав для виконання AI-дії (${action.type}).`,
          },
          { status: 403 },
        );
      }
      await executeAiAction({ dealId, action });
    }
  }
  await recordContinuousLearningEvent({
    userId: user.id,
    action: "ai_contextual_result",
    stage: "contextual",
    entityType: leadId ? "LEAD" : dealId ? "DEAL" : "DASHBOARD",
    entityId: leadId ?? dealId ?? user.id,
    ok: true,
    metadata: {
      context,
      executeActions: Boolean(executeActions),
      insights: ai.insights.length,
      risks: ai.risks.length,
      recommendations: ai.recommendations.length,
      actions: ai.actions.length,
    },
  });
  await logAiEvent({
    userId: user.id,
    action: "ai_contextual_result",
    model: process.env.AI_MODEL ?? null,
    ok: true,
    metadata: {
      context,
      executeActions: Boolean(executeActions),
      insights: ai.insights.length,
      risks: ai.risks.length,
      recommendations: ai.recommendations.length,
      actions: ai.actions.length,
    },
  });
  return NextResponse.json(ai);
}
