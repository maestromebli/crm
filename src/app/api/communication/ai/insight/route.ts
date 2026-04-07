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
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
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

  const gen = await generateConversationInsight({ transcript });
  if (gen.ok === false) {
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

  await logAiEvent({
    userId: user.id,
    action: "comm_conversation_insight",
    entityType: hub.entity,
    entityId: hub.entityId,
    model: process.env.AI_MODEL ?? null,
    ok: true,
    metadata: { threadId: tid },
  });

  return NextResponse.json({ ok: true, insight: gen.data });
}
