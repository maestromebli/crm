import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AI_OPERATIONS,
  type AiOperationId,
} from "../../../../features/ai/core/types";
import { runAiOperation } from "../../../../features/ai/server/run-operation";
import { requireSessionUser } from "../../../../lib/authz/api-guard";
import { hasEffectivePermission, P } from "../../../../lib/authz/permissions";
import { requireDatabaseUrl } from "../../../../lib/api/route-guards";
import { recordContinuousLearningEvent } from "../../../../lib/ai/continuous-learning";
import { resolveAiExecutionPolicy } from "../../../../features/ai/policies/ai-action-guard";
import { requireAiRateLimit } from "../../../../lib/ai/route-guard";
import { logAiEvent } from "../../../../lib/ai/log-ai-event";

export const runtime = "nodejs";

const bodySchema = z.object({
  operation: z
    .string()
    .refine(
      (o): o is AiOperationId =>
        (AI_OPERATIONS as readonly string[]).includes(o),
      "Невідома операція",
    ),
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  dashboardContext: z.string().max(120_000).optional(),
  tone: z.enum(["neutral", "friendly", "formal"]).optional(),
});

function permCtx(user: {
  realRole: string;
  impersonatorId?: string;
}) {
  return {
    realRole: user.realRole,
    impersonatorId: user.impersonatorId,
  };
}

function canRunOperation(
  user: {
    permissionKeys: string[];
    realRole: string;
    impersonatorId?: string;
  },
  operation: AiOperationId,
): boolean {
  const ctx = permCtx(user);
  if (operation === "dashboard_brief") {
    return hasEffectivePermission(
      user.permissionKeys,
      P.DASHBOARD_VIEW,
      ctx,
    );
  }
  if (
    operation === "lead_summary" ||
    operation === "lead_next_step" ||
    operation === "lead_follow_up" ||
    operation === "lead_risk_explain" ||
    operation === "proposal_intro"
  ) {
    return hasEffectivePermission(user.permissionKeys, P.LEADS_VIEW, ctx);
  }
  if (operation === "deal_summary" || operation === "deal_readiness") {
    return hasEffectivePermission(user.permissionKeys, P.DEALS_VIEW, ctx);
  }
  return false;
}

export async function POST(request: Request) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некоректні дані", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { operation, leadId, dealId, dashboardContext, tone } = parsed.data;
  const limited = await requireAiRateLimit({
    userId: user.id,
    action: "ai_operation",
    maxRequests: 24,
    windowMinutes: 10,
  });
  if (limited) return limited;

  if (!canRunOperation(user, operation)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }
  const policy = resolveAiExecutionPolicy({ user, operation });
  if (!policy.allowed) {
    return NextResponse.json(
      { error: "Недостатньо прав для AI", policy },
      { status: 403 },
    );
  }

  const needsLead =
    operation === "lead_summary" ||
    operation === "lead_next_step" ||
    operation === "lead_follow_up" ||
    operation === "lead_risk_explain" ||
    operation === "proposal_intro";
  const needsDeal = operation === "deal_summary" || operation === "deal_readiness";
  const needsDash = operation === "dashboard_brief";

  if (needsLead && !leadId?.trim()) {
    return NextResponse.json(
      { error: "Для цієї операції потрібний leadId" },
      { status: 400 },
    );
  }
  if (needsDeal && !dealId?.trim()) {
    return NextResponse.json(
      { error: "Для цієї операції потрібний dealId" },
      { status: 400 },
    );
  }
  if (needsDash && !dashboardContext?.trim()) {
    return NextResponse.json(
      { error: "Для цієї операції потрібний dashboardContext" },
      { status: 400 },
    );
  }

  const result = await runAiOperation({
    user,
    operation,
    leadId,
    dealId,
    dashboardContext,
    tone,
  });

  if (result.ok === false) {
    await logAiEvent({
      userId: user.id,
      action: "ai_operation",
      model: process.env.AI_MODEL ?? "gpt-4.1-mini",
      ok: false,
      errorMessage: result.error,
      metadata: { operation, leadId, dealId, status: result.status },
    });
    await recordContinuousLearningEvent({
      userId: user.id,
      action: "ai_operation",
      stage: "operations",
      entityType: leadId ? "LEAD" : dealId ? "DEAL" : "DASHBOARD",
      entityId: leadId ?? dealId ?? user.id,
      ok: false,
      metadata: { operation, status: result.status, error: result.error },
    });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await recordContinuousLearningEvent({
    userId: user.id,
    action: "ai_operation",
    stage: "operations",
    entityType: leadId ? "LEAD" : dealId ? "DEAL" : "DASHBOARD",
    entityId: leadId ?? dealId ?? user.id,
    ok: true,
    metadata: {
      operation,
      advisoryOnly: policy.advisoryOnly,
      reason: policy.reason,
    },
  });
  await logAiEvent({
    userId: user.id,
    action: "ai_operation",
    model: process.env.AI_MODEL ?? "gpt-4.1-mini",
    ok: true,
    metadata: {
      operation,
      leadId,
      dealId,
      advisoryOnly: policy.advisoryOnly,
      reason: policy.reason,
    },
  });

  return NextResponse.json({
    ...result,
    policy: {
      advisoryOnly: policy.advisoryOnly,
      reason: policy.reason,
    },
  });
}
