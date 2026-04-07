import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDatabaseUrl } from "@/lib/api/route-guards";
import { requireSessionUser } from "@/lib/authz/api-guard";
import {
  AI_V2_EVENT_TYPES,
  buildAiV2ActionPlan,
  buildAiV2ActorContext,
  buildAiV2ContextSnapshot,
  buildAiV2MemorySnapshot,
  canReadAiV2Context,
  executeAiV2LowRiskActions,
  logAiV2InsightRun,
  publishAiV2Event,
  runAiV2DecisionEngine,
  type AiV2ContextName,
  type AiV2EventType,
} from "@/features/ai-v2/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  context: z.enum(["lead", "deal", "dashboard", "finance", "production", "procurement"]),
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  applyLowRiskActions: z.boolean().optional(),
});

function defaultEventByContext(context: AiV2ContextName): AiV2EventType {
  if (context === "lead") return AI_V2_EVENT_TYPES.lead_updated;
  if (context === "finance") return AI_V2_EVENT_TYPES.payment_expected;
  if (context === "production") return AI_V2_EVENT_TYPES.production_ready_check;
  if (context === "procurement") return AI_V2_EVENT_TYPES.purchase_needed;
  if (context === "deal") return AI_V2_EVENT_TYPES.quote_viewed;
  return AI_V2_EVENT_TYPES.manager_assigned;
}

export async function POST(request: Request) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні параметри запиту" }, { status: 400 });
  }

  const actor = buildAiV2ActorContext(user);
  if (!canReadAiV2Context(actor, parsed.data.context)) {
    return NextResponse.json({ error: "Недостатньо прав для AI V2 контексту" }, { status: 403 });
  }

  const snapshot = await buildAiV2ContextSnapshot({
    actor,
    context: parsed.data.context,
    leadId: parsed.data.leadId,
    dealId: parsed.data.dealId,
  });
  if (!snapshot) {
    return NextResponse.json({ error: "Контекст недоступний або не знайдений" }, { status: 404 });
  }

  const decision = runAiV2DecisionEngine(snapshot);
  const plannedActions = buildAiV2ActionPlan(snapshot, decision);
  const executionResult = parsed.data.applyLowRiskActions
    ? await executeAiV2LowRiskActions({
        actor,
        context: snapshot,
        actions: plannedActions,
      })
    : { executed: [], skippedDuplicates: [] };
  const executedActions = executionResult.executed;
  const skippedDuplicateActions = executionResult.skippedDuplicates;
  const memory = await buildAiV2MemorySnapshot({ context: snapshot, decision });

  await publishAiV2Event({
    type: defaultEventByContext(snapshot.context),
    entityType: snapshot.entityType,
    entityId: snapshot.entityId,
    actorUserId: actor.userId,
    dealId: parsed.data.dealId,
    payload: {
      context: snapshot.context,
      riskScore: decision.riskScore,
      executedActions: executedActions.map((a) => a.type),
      skippedDuplicateActions: skippedDuplicateActions.map((a) => a.type),
    },
  });

  await logAiV2InsightRun({
    actor,
    context: snapshot,
    decision,
    plannedActions,
    executedActions,
    skippedDuplicateActions,
  });

  return NextResponse.json({
    context: snapshot,
    decision,
    plannedActions,
    executedActions,
    skippedDuplicateActions,
    memory,
  });
}
