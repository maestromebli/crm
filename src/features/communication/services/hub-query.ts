import { prisma } from "../../../lib/prisma";
import type { CommunicationHubPayload } from "../types/hub-dto";
import { syncLeadMessagesToCommLayer } from "./sync-lead-messages";
import { computeFollowUpsForEntity } from "../followups/engine";

async function defaultChannelHealth(): Promise<CommunicationHubPayload["channelHealth"]> {
  const rows = await prisma.commChannelAccount.findMany({
    take: 20,
    orderBy: { updatedAt: "desc" },
  });
  if (rows.length > 0) {
    return rows.map((r) => ({
      channelType: r.type,
      syncStatus: r.syncStatus,
      title: r.title,
      lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
      lastError: r.lastError,
    }));
  }
  return [
    {
      channelType: "TELEGRAM",
      syncStatus: "DISCONNECTED",
      title: "Telegram (не підключено)",
      lastSyncedAt: null,
      lastError: null,
    },
    {
      channelType: "INSTAGRAM",
      syncStatus: "DISCONNECTED",
      title: "Instagram (не підключено)",
      lastSyncedAt: null,
      lastError: null,
    },
  ];
}

export async function buildCommunicationHub(input: {
  leadId?: string;
  dealId?: string;
}): Promise<CommunicationHubPayload | null> {
  let entity: "LEAD" | "DEAL" = "LEAD";
  let entityId = "";
  let threadWhere: {
    OR: Array<{ entityType: "LEAD" | "DEAL"; entityId: string }>;
  } = { OR: [] };

  if (input.leadId) {
    entityId = input.leadId;
    await syncLeadMessagesToCommLayer(input.leadId);
    threadWhere = { OR: [{ entityType: "LEAD", entityId: input.leadId }] };
  } else if (input.dealId) {
    entity = "DEAL";
    entityId = input.dealId;
    const deal = await prisma.deal.findUnique({
      where: { id: input.dealId },
      select: { leadId: true },
    });
    if (!deal) return null;
    if (deal.leadId) {
      await syncLeadMessagesToCommLayer(deal.leadId);
      threadWhere = {
        OR: [
          { entityType: "DEAL", entityId: input.dealId },
          { entityType: "LEAD", entityId: deal.leadId },
        ],
      };
    } else {
      threadWhere = {
        OR: [{ entityType: "DEAL", entityId: input.dealId }],
      };
    }
  } else {
    return null;
  }

  const threads = await prisma.commThread.findMany({
    where: threadWhere,
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: 40,
  });

  const threadIds = threads.map((t) => t.id);
  const messages =
    threadIds.length === 0
      ? []
      : await prisma.commMessage.findMany({
          where: { threadId: { in: threadIds } },
          orderBy: { sentAt: "asc" },
          take: 800,
          select: {
            id: true,
            threadId: true,
            direction: true,
            senderName: true,
            text: true,
            sentAt: true,
            messageKind: true,
          },
        });

  const messagesByThread: CommunicationHubPayload["messagesByThread"] = {};
  for (const m of messages) {
    const list = messagesByThread[m.threadId] ?? [];
    list.push({
      id: m.id,
      threadId: m.threadId,
      direction: m.direction,
      senderName: m.senderName,
      text: m.text,
      sentAt: m.sentAt.toISOString(),
      messageKind: m.messageKind,
    });
    messagesByThread[m.threadId] = list;
  }

  let primaryInsight: CommunicationHubPayload["primaryInsight"] = null;
  const primaryThread =
    threads.find((t) => t.channelType === "TELEGRAM") ??
    threads.find((t) => t.channelType === "INSTAGRAM") ??
    threads[0];
  if (primaryThread) {
    const ins = await prisma.commConversationInsight.findUnique({
      where: { threadId: primaryThread.id },
    });
    if (ins) {
      primaryInsight = {
        summaryShort: ins.summaryShort,
        summaryDetailed: ins.summaryDetailed,
        clientIntent: ins.clientIntent,
        recommendedNextStep: ins.recommendedNextStep,
        recommendedReply: ins.recommendedReply,
        missingInfoJson: ins.missingInfoJson,
        confidenceScore: ins.confidenceScore,
        generatedAt: ins.generatedAt.toISOString(),
      };
    }
  }

  const followUps = await computeFollowUpsForEntity({
    entityType: entity,
    entityId,
    threadIds,
  });

  const hubThreads: CommunicationHubPayload["threads"] = threads.map((t) => {
    const msgs = messagesByThread[t.id] ?? [];
    const last = msgs[msgs.length - 1];
    return {
      id: t.id,
      channelType: t.channelType,
      title: t.title,
      lastMessageAt: t.lastMessageAt?.toISOString() ?? null,
      unreadCount: t.unreadCount,
      status: t.status,
      needsReply: t.needsReply,
      followUpAt: t.followUpAt?.toISOString() ?? null,
      aiSummary: t.aiSummary,
      preview: last?.text?.slice(0, 140) ?? null,
    };
  });

  return {
    entity,
    entityId,
    threads: hubThreads,
    messagesByThread,
    primaryInsight,
    followUps,
    channelHealth: await defaultChannelHealth(),
  };
}
