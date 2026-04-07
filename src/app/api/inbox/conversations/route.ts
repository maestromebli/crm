import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import type { InboxConversation, InboxMessage } from "../../../../features/inbox/types";
import {
  buildCustomerHandle,
  inboxChannelFromPrisma,
  messengerSummaryDeliveryStatus,
  messengerSummaryDirection,
} from "../../../../lib/leads/lead-messenger-thread";
import { ownerIdWhere, resolveAccessContext } from "../../../../lib/authz/data-scope";
import { prisma } from "../../../../lib/prisma";

const MESSENGER_DB_CHANNELS = [
  "TELEGRAM",
  "INSTAGRAM",
  "WHATSAPP",
  "VIBER",
  "SMS",
  "EMAIL",
  "WEBCHAT",
] as const;

export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.LEADS_VIEW);
  if (denied) return denied;

  const url = new URL(req.url);
  const perLead = Math.max(5, Math.min(Number(url.searchParams.get("perLead") ?? 40), 80));
  const limit = Math.max(20, Math.min(Number(url.searchParams.get("limit") ?? 120), 300));
  const access = await resolveAccessContext(prisma, {
    id: user.id,
    role: user.dbRole,
  });
  const ownerWhere = ownerIdWhere(access);

  const rows = await prisma.leadMessage.findMany({
    where: {
      interactionKind: "MESSAGE",
      channel: { in: [...MESSENGER_DB_CHANNELS] },
      lead: ownerWhere ? { ownerId: ownerWhere } : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      leadId: true,
      body: true,
      summary: true,
      channel: true,
      createdAt: true,
      lead: {
        select: {
          title: true,
          ownerId: true,
          owner: { select: { name: true } },
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
      },
    },
  });

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const arr = grouped.get(row.leadId) ?? [];
    if (arr.length < perLead) arr.push(row);
    grouped.set(row.leadId, arr);
  }

  const conversations: InboxConversation[] = [];
  for (const [leadId, leadRowsDesc] of grouped) {
    const leadRows = [...leadRowsDesc].reverse();
    const latest = leadRows[leadRows.length - 1];
    if (!latest) continue;
    const messages: InboxMessage[] = leadRows.map((r) => ({
      id: r.id,
      direction: messengerSummaryDirection(r.summary),
      text: r.body,
      createdAt: r.createdAt.toISOString(),
      deliveryStatus: messengerSummaryDeliveryStatus(r.summary),
    }));
    conversations.push({
      id: `lead-${leadId}`,
      customerName:
        latest.lead.contact?.fullName?.trim() || latest.lead.title || "Клієнт",
      customerHandle: buildCustomerHandle(latest.lead.contact),
      channel: inboxChannelFromPrisma(latest.channel),
      lastMessagePreview: latest.body,
      lastMessageAt: latest.createdAt.toISOString(),
      unreadCount: leadRows.filter((r) => messengerSummaryDirection(r.summary) === "in")
        .length,
      hasUnanswered: messengerSummaryDirection(latest.summary) === "in",
      slaState: "ok",
      status: "open",
      assignee: latest.lead.owner?.name ?? undefined,
      linkedEntityType: "lead",
      linkedEntityLabel: latest.lead.title,
      messages,
    });
  }

  conversations.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  return NextResponse.json({ ok: true, items: conversations });
}
