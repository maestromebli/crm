import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { appendActivityLog } from "../../../../../lib/deal-api/audit";
import {
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import type { InboxChannel } from "../../../../../features/inbox/types";
import {
  availableLeadMessengerChannels,
  buildLeadMessengerConversation,
  formatMessengerTime,
  inboxChannelFromPrisma,
  mapRowsToInboxMessages,
  messengerSummaryDirection,
  prismaChannelForInbox,
  resolveLeadMessengerChannel,
} from "../../../../../lib/leads/lead-messenger-thread";
import { dispatchOutboundLeadMessage } from "../../../../../lib/messaging/outbound-dispatch";
import { prisma } from "../../../../../lib/prisma";

const MESSENGER_DB_CHANNELS = ["TELEGRAM", "INSTAGRAM", "WHATSAPP", "VIBER", "SMS", "EMAIL", "WEBCHAT"] as const;

type Ctx = { params: Promise<{ leadId: string }> };

const MAX_BODY = 4000;

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { leadId } = await ctx.params;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        title: true,
        ownerId: true,
        contact: {
          select: {
            fullName: true,
            phone: true,
            email: true,
            telegramHandle: true,
            instagramHandle: true,
          },
        },
      },
    });
    if (!lead) {
      return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessLeadAccess(user, P.LEADS_VIEW, lead);
    if (denied) return denied;

    const messengerRows = await prisma.leadMessage.findMany({
      where: {
        leadId,
        channel: { in: [...MESSENGER_DB_CHANNELS] },
      },
      orderBy: { createdAt: "asc" },
      take: 300,
      select: {
        id: true,
        body: true,
        channel: true,
        summary: true,
        createdAt: true,
      },
    });

    const inboxMessages = mapRowsToInboxMessages(messengerRows);

    const lastMessageAtIso =
      messengerRows[messengerRows.length - 1]?.createdAt.toISOString() ?? null;

    const conversation = buildLeadMessengerConversation({
      leadId: lead.id,
      leadTitle: lead.title,
      contact: lead.contact,
      messages: inboxMessages,
      lastMessageAtIso,
    });

    return NextResponse.json({
      ok: true,
      conversation,
      defaultOutboundChannel: resolveLeadMessengerChannel(lead.contact),
      availableOutboundChannels: availableLeadMessengerChannels(lead.contact),
    });
  } catch (e) {
     
    console.error("[GET leads/[leadId]/messenger-thread]", e);
    return NextResponse.json(
      { error: "Помилка завантаження" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { leadId } = await ctx.params;

  let body: { text?: string; channel?: InboxChannel };
  try {
    body = (await req.json()) as { text?: string; channel?: InboxChannel };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Введіть текст" }, { status: 400 });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: "Текст завеликий" }, { status: 400 });
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        ownerId: true,
        title: true,
        contact: {
          select: {
            fullName: true,
            phone: true,
            email: true,
            telegramHandle: true,
            instagramHandle: true,
          },
        },
      },
    });
    if (!lead) {
      return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
    if (denied) return denied;

    const allowedChannels = new Set(availableLeadMessengerChannels(lead.contact));
    const requestedChannel =
      typeof body.channel === "string" ? inboxChannelFromPrisma(body.channel) : null;
    const inboxCh =
      requestedChannel && allowedChannels.has(requestedChannel)
        ? requestedChannel
        : resolveLeadMessengerChannel(lead.contact);
    const channel = prismaChannelForInbox(inboxCh);

    const dispatch = await dispatchOutboundLeadMessage({
      leadId,
      ownerUserId: lead.ownerId,
      channel: inboxCh,
      text,
      contact: lead.contact,
    });
    const summary = [
      "out",
      channel.toLowerCase(),
      dispatch.providerMessageId ? `ext:${dispatch.providerMessageId}` : null,
      `delivery:${dispatch.delivery}`,
      dispatch.error ? `error:${dispatch.error}` : null,
    ]
      .filter(Boolean)
      .join("|");

    const row = await prisma.leadMessage.create({
      data: {
        leadId,
        body: text,
        channel,
        interactionKind: "MESSAGE",
        summary,
        createdById: user.id,
      },
    });

    await appendActivityLog({
      entityType: "LEAD",
      entityId: leadId,
      type: "LEAD_UPDATED",
      actorUserId: user.id,
      data: { note: "messenger_outbound", messageId: row.id, channel },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { lastActivityAt: new Date() },
    });

    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/messages`);

    return NextResponse.json({
      ok: true,
      delivery: dispatch.delivery,
      providerError: dispatch.error ?? null,
      message: {
        id: row.id,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        direction: messengerSummaryDirection(row.summary),
        displayTime: formatMessengerTime(row.createdAt.toISOString()),
      },
    });
  } catch (e) {
     
    console.error("[POST leads/[leadId]/messenger-thread]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
