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
import {
  generateSuggestedReply,
  type ReplyStyle,
} from "../../../../../features/communication/ai/suggested-reply";
import { logAiEvent } from "../../../../../lib/ai/log-ai-event";

export const runtime = "nodejs";

const bodySchema = z.object({
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  style: z
    .enum([
      "short",
      "standard",
      "premium",
      "polite",
      "assertive",
      "follow_up",
      "objection",
    ])
    .optional(),
});

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
  const style = (parsed.data.style ?? "standard") as ReplyStyle;

  if ((!leadId && !dealId) || (leadId && dealId)) {
    return NextResponse.json(
      { error: "Вкажіть leadId або dealId" },
      { status: 400 },
    );
  }

  if (leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, ownerId: true, stage: { select: { name: true } } },
    });
    if (!lead) {
      return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
    }
    const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
    if (denied) return denied;

    const hub = await buildCommunicationHub({ leadId });
    const transcript = Object.values(hub?.messagesByThread ?? {})
      .flat()
      .map((m) => m.text)
      .join("\n");
    if (!transcript.trim()) {
      return NextResponse.json(
        { error: "Немає тексту переписки" },
        { status: 400 },
      );
    }

    const gen = await generateSuggestedReply({
      transcript,
      style,
      stageHint: lead.stage?.name ?? null,
    });
    if (!gen.ok) {
      return NextResponse.json({ error: gen.error }, { status: 503 });
    }

    await logAiEvent({
      userId: user.id,
      action: "comm_suggested_reply",
      entityType: "LEAD",
      entityId: leadId,
      ok: true,
      metadata: { style },
    });

    return NextResponse.json({ ok: true, text: gen.text });
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId! },
    select: { id: true, ownerId: true, stage: { select: { name: true } } },
  });
  if (!deal) {
    return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
  }
  const denied = await forbidUnlessDealAccess(user, P.DEALS_UPDATE, deal);
  if (denied) return denied;

  const hub = await buildCommunicationHub({ dealId: deal.id });
  const transcript = Object.values(hub?.messagesByThread ?? {})
    .flat()
    .map((m) => m.text)
    .join("\n");
  if (!transcript.trim()) {
    return NextResponse.json(
      { error: "Немає тексту переписки" },
      { status: 400 },
    );
  }

  const gen = await generateSuggestedReply({
    transcript,
    style,
    stageHint: deal.stage?.name ?? null,
  });
  if (!gen.ok) {
    return NextResponse.json({ error: gen.error }, { status: 503 });
  }

  await logAiEvent({
    userId: user.id,
    action: "comm_suggested_reply",
    entityType: "DEAL",
    entityId: dealId!,
    ok: true,
    metadata: { style },
  });

  return NextResponse.json({ ok: true, text: gen.text });
}
