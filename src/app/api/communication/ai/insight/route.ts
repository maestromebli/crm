import { NextResponse } from "next/server";
import { z } from "zod";
import {
  forbidUnlessDealAccess,
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { requireDatabaseUrl } from "../../../../../lib/api/route-guards";
import { prisma } from "../../../../../lib/prisma";
import { buildCommunicationHub } from "../../../../../features/communication/services/hub-query";
import { generateConversationInsight } from "../../../../../features/communication/ai/conversation-insight";
import { persistConversationInsight } from "../../../../../features/communication/services/persist-insight";
import {
  buildContinuousLearningBlock,
  recordContinuousLearningEvent,
} from "../../../../../lib/ai/continuous-learning";
import { requireAiRateLimit } from "../../../../../lib/ai/route-guard";
import { logAiEvent } from "../../../../../lib/ai/log-ai-event";

export const runtime = "nodejs";

const bodySchema = z.object({
  leadId: z.string().optional(),
  dealId: z.string().optional(),
});

function primaryThreadId(
  threads: { id: string; channelType: string }[],
): string | null {
  const t =
    threads.find((x) => x.channelType === "TELEGRAM") ??
    threads.find((x) => x.channelType === "INSTAGRAM") ??
    threads[0];
  return t?.id ?? null;
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

  const { leadId, dealId } = parsed.data;
  const limited = await requireAiRateLimit({
    userId: user.id,
    action: "comm_conversation_insight",
    maxRequests: 24,
    windowMinutes: 10,
  });
  if (limited) return limited;
  if ((!leadId && !dealId) || (leadId && dealId)) {
    return NextResponse.json(
      { error: "Вкажіть leadId або dealId" },
      { status: 400 },
    );
  }

  if (leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, ownerId: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
    }
    const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
    if (denied) return denied;
  }

  if (dealId) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
    }
    const denied = await forbidUnlessDealAccess(user, P.DEALS_UPDATE, deal);
    if (denied) return denied;
  }

  const hub = await buildCommunicationHub({
    leadId: leadId ?? undefined,
    dealId: dealId ?? undefined,
  });
  if (!hub) {
    return NextResponse.json({ error: "Немає даних" }, { status: 404 });
  }

  const lines: string[] = [];
  for (const t of hub.threads) {
    const msgs = hub.messagesByThread[t.id] ?? [];
    for (const m of msgs) {
      lines.push(
        `[${t.channelType} ${m.direction}] ${m.sentAt}: ${m.text}`,
      );
    }
  }
  const transcript = lines.join("\n");
  if (!transcript.trim()) {
    return NextResponse.json(
      { error: "Немає повідомлень для аналізу" },
      { status: 400 },
    );
  }

  const memory = await buildContinuousLearningBlock({
    userId: user.id,
    entityType: hub.entity,
    entityId: hub.entityId,
    take: 10,
  });

  const transcriptForAi = memory
    ? `${memory}\n\nConversation transcript:\n${transcript}`
    : transcript;
  const gen = await generateConversationInsight({ transcript: transcriptForAi });
  if (gen.ok === false) {
    await logAiEvent({
      userId: user.id,
      action: "comm_conversation_insight",
      model: process.env.AI_MODEL ?? null,
      ok: false,
      errorMessage: gen.error,
      entityType: hub.entity,
      entityId: hub.entityId,
    });
    return NextResponse.json({ error: gen.error }, { status: 503 });
  }

  const tid = primaryThreadId(hub.threads);
  if (!tid) {
    return NextResponse.json(
      { error: "Немає потоку для збереження інсайту" },
      { status: 400 },
    );
  }

  await persistConversationInsight({
    entityType: hub.entity,
    entityId: hub.entityId,
    threadId: tid,
    data: gen.data,
  });

  await recordContinuousLearningEvent({
    userId: user.id,
    action: "comm_conversation_insight",
    stage: "communication_insight",
    entityType: hub.entity,
    entityId: hub.entityId,
    ok: true,
    metadata: {
      threadId: tid,
      model: gen.model,
      usedLearningMemory: Boolean(memory),
      promptTokens: gen.usage?.promptTokens ?? 0,
      completionTokens: gen.usage?.completionTokens ?? 0,
      totalTokens: gen.usage?.totalTokens ?? 0,
      tokensApprox: gen.tokensApprox,
      costUsdApprox: gen.costUsdApprox,
    },
  });
  await logAiEvent({
    userId: user.id,
    action: "comm_conversation_insight",
    model: gen.model,
    ok: true,
    tokensApprox:
      gen.usage?.totalTokens && gen.usage.totalTokens > 0
        ? gen.usage.totalTokens
        : gen.tokensApprox,
    entityType: hub.entity,
    entityId: hub.entityId,
    metadata: {
      threadId: tid,
      usedLearningMemory: Boolean(memory),
      promptTokens: gen.usage?.promptTokens ?? 0,
      completionTokens: gen.usage?.completionTokens ?? 0,
      totalTokens: gen.usage?.totalTokens ?? 0,
      tokensApprox: gen.tokensApprox,
      costUsdApprox: gen.costUsdApprox,
    },
  });

  return NextResponse.json({ ok: true, insight: gen.data });
}
