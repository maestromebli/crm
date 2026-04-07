import { prisma } from "../../../lib/prisma";
import type { HubFollowUpDto } from "../types/hub-dto";

/**
 * Гібрид правил + збережених пропозицій (без «жорсткого» фейку — лише реальні дані CRM).
 */
export async function computeFollowUpsForEntity(input: {
  entityType: "LEAD" | "DEAL";
  entityId: string;
  threadIds: string[];
}): Promise<HubFollowUpDto[]> {
  const stored =
    input.threadIds.length === 0
      ? []
      : await prisma.commFollowUpSuggestion.findMany({
          where: {
            entityType: input.entityType,
            entityId: input.entityId,
            status: "OPEN",
          },
          orderBy: { suggestedAt: "desc" },
          take: 12,
        });

  const out: HubFollowUpDto[] = stored.map((s) => ({
    id: s.id,
    reason: s.reason,
    draftMessage: s.draftMessage,
    dueAt: s.dueAt?.toISOString() ?? null,
    urgency: s.urgency,
    status: s.status,
  }));

  if (input.entityType === "LEAD") {
    const lead = await prisma.lead.findUnique({
      where: { id: input.entityId },
      select: {
        lastActivityAt: true,
        proposals: {
          orderBy: { version: "desc" },
          take: 1,
          select: { status: true, sentAt: true },
        },
      },
    });
    const p = lead?.proposals[0];
    if (
      p?.status === "SENT" &&
      p.sentAt &&
      Date.now() - p.sentAt.getTime() > 48 * 3600 * 1000
    ) {
      out.unshift({
        id: `rule-kp-silence-${input.entityId}`,
        reason:
          "КП надіслано понад 48 год. без відповіді — рекомендовано м’який фоллоуап.",
        draftMessage: null,
        dueAt: null,
        urgency: "medium",
        status: "OPEN",
      });
    }
  }

  return out.slice(0, 15);
}
