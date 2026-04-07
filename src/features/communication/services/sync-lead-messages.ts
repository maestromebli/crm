import type {
  CommChannelType,
  CommMessageDirection,
  CommMessageKind,
  CommSenderType,
  CommThreadStatus,
} from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  isMessengerChannel,
  messengerSummaryDirection,
} from "../../../lib/leads/lead-messenger-thread";

function mapToChannelType(row: {
  channel: string;
  interactionKind: string;
}): CommChannelType {
  const ch = row.channel.trim().toUpperCase();
  if (isMessengerChannel(ch)) {
    return ch as CommChannelType;
  }
  if (row.interactionKind === "CALL" || ch === "PHONE") {
    return "CALL_LOG";
  }
  return "INTERNAL_NOTE";
}

function mapDirectionAndKind(row: {
  channel: string;
  summary: string | null;
  interactionKind: string;
}): {
  direction: CommMessageDirection;
  kind: CommMessageKind;
  sender: CommSenderType;
} {
  const ch = row.channel.trim().toUpperCase();
  if (isMessengerChannel(ch)) {
    const d = messengerSummaryDirection(row.summary);
    return {
      direction: d === "in" ? "INBOUND" : "OUTBOUND",
      kind: "TEXT",
      sender: d === "in" ? "CLIENT" : "MANAGER",
    };
  }
  if (row.interactionKind === "CALL") {
    return {
      direction: "INTERNAL",
      kind: "NOTE",
      sender: "MANAGER",
    };
  }
  return {
    direction: "INTERNAL",
    kind: "NOTE",
    sender: "MANAGER",
  };
}

/**
 * Ідемпотентно імпортує `LeadMessage` у шар Comm* (для єдиного хаба).
 */
export async function syncLeadMessagesToCommLayer(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, title: true, contact: { select: { fullName: true, phone: true } } },
  });
  if (!lead) return;

  const rows = await prisma.leadMessage.findMany({
    where: { leadId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      channel: true,
      interactionKind: true,
      summary: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  const byChannel = new Map<CommChannelType, typeof rows>();
  for (const r of rows) {
    const ct = mapToChannelType({
      channel: r.channel,
      interactionKind: r.interactionKind,
    });
    const list = byChannel.get(ct) ?? [];
    list.push(r);
    byChannel.set(ct, list);
  }

  for (const [channelType, list] of byChannel) {
    const thread = await prisma.commThread.upsert({
      where: {
        entityType_entityId_channelType: {
          entityType: "LEAD",
          entityId: leadId,
          channelType,
        },
      },
      create: {
        entityType: "LEAD",
        entityId: leadId,
        channelType,
        title:
          channelType === "INTERNAL_NOTE"
            ? `Нотатки CRM · ${lead.title}`
            : `${channelType} · ${lead.title}`,
        participantName: lead.contact?.fullName ?? null,
        participantPhone: lead.contact?.phone ?? null,
        status: "WAITING_CLIENT",
      },
      update: {
        title:
          channelType === "INTERNAL_NOTE"
            ? `Нотатки CRM · ${lead.title}`
            : `${channelType} · ${lead.title}`,
      },
    });

    for (const r of list) {
      const exists = await prisma.commMessage.findFirst({
        where: { legacyLeadMessageId: r.id },
        select: { id: true },
      });
      if (exists) continue;

      const dk = mapDirectionAndKind({
        channel: r.channel,
        summary: r.summary,
        interactionKind: r.interactionKind,
      });

      await prisma.commMessage.create({
        data: {
          threadId: thread.id,
          legacyLeadMessageId: r.id,
          direction: dk.direction,
          senderType: dk.sender,
          senderName: r.createdBy.name ?? r.createdBy.email ?? null,
          authorUserId: r.createdBy.id,
          text: r.body,
          messageKind: dk.kind,
          sentAt: r.createdAt,
          deliveryStatus:
            dk.direction === "OUTBOUND" && isMessengerChannel(r.channel.toUpperCase())
              ? "SENT"
              : undefined,
        },
      });
    }

    const last = await prisma.commMessage.findFirst({
      where: { threadId: thread.id },
      orderBy: { sentAt: "desc" },
      select: { direction: true, sentAt: true },
    });

    let status: CommThreadStatus = "WAITING_CLIENT";
    if (last?.direction === "INBOUND") status = "NEEDS_REPLY";
    else if (last?.direction === "OUTBOUND") status = "WAITING_CLIENT";

    await prisma.commThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: last?.sentAt ?? null,
        status,
        needsReply: last?.direction === "INBOUND",
      },
    });
  }
}
