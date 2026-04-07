import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendActivityLog } from "@/lib/deal-api/audit";
import { seedDealPaymentPlan7030 } from "@/lib/deals/payment-milestones";
import { dispatchDealAutomationTrigger } from "@/lib/automation/dispatch";

export const CRM_EVENT_TYPES = {
  DEAL_CREATED: "deal.created",
  STAGE_CHANGED: "stage.changed",
  QUOTE_APPROVED: "quote.approved",
  CONTRACT_SIGNED: "contract.signed",
  PAYMENT_RECEIVED: "payment.received",
  PROCUREMENT_CREATED: "procurement.created",
  PRODUCTION_STARTED: "production.started",
  PRODUCTION_DELAYED: "production.delayed",
} as const;

export type CrmEventType = (typeof CRM_EVENT_TYPES)[keyof typeof CRM_EVENT_TYPES];

type EventEnvelope = {
  type: CrmEventType;
  dealId: string;
  payload?: Prisma.InputJsonValue;
  dedupeKey?: string;
};

function payloadObject(
  payload: Prisma.JsonValue | Prisma.InputJsonValue | undefined,
): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload as Record<string, unknown>;
}

async function handleEvent(eventId: string): Promise<void> {
  const event = await prisma.domainEvent.findUnique({ where: { id: eventId } });
  if (!event || event.processedAt) return;
  const data = payloadObject(event.payload);
  const dealId = event.dealId ?? (typeof data.dealId === "string" ? data.dealId : null);
  if (!dealId) {
    await prisma.domainEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });
    return;
  }

  const dealOwner = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true },
  });

  switch (event.type) {
    case CRM_EVENT_TYPES.QUOTE_APPROVED: {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: { value: true, currency: true, workspaceMeta: true },
      });
      if (deal?.value && deal.value > 0) {
        const hasPlan = await prisma.dealPaymentPlan.findUnique({
          where: { dealId },
          select: { id: true },
        });
        if (!hasPlan) {
          await seedDealPaymentPlan7030(prisma, {
            dealId,
            total: deal.value,
            currency: deal.currency?.trim() || "UAH",
          });
        }
      }
      break;
    }
    case CRM_EVENT_TYPES.PAYMENT_RECEIVED: {
      const ratioRaw = data.percent70Reached;
      const is70Reached = ratioRaw === true;
      if (is70Reached) {
        await prisma.task.create({
          data: {
            title: "Підготувати закупку після 70% оплати",
            description: "Автоматично створено після підтвердження передоплати.",
            entityType: "DEAL",
            entityId: dealId,
            taskType: "VERIFY_PAYMENT",
            status: "OPEN",
            priority: "HIGH",
            assigneeId: dealOwner?.ownerId ?? null,
            createdById: dealOwner?.ownerId ?? null,
          },
        });
      }
      break;
    }
    case CRM_EVENT_TYPES.PROCUREMENT_CREATED: {
      await prisma.task.create({
        data: {
          title: "Старт виробництва",
          description: "Закупка створена — запустіть виробниче замовлення.",
          entityType: "DEAL",
          entityId: dealId,
          taskType: "OTHER",
          status: "OPEN",
          priority: "HIGH",
          assigneeId: dealOwner?.ownerId ?? null,
          createdById: dealOwner?.ownerId ?? null,
        },
      });
      break;
    }
    case CRM_EVENT_TYPES.PRODUCTION_DELAYED: {
      await appendActivityLog({
        entityType: "DEAL",
        entityId: dealId,
        type: "PRODUCTION_NOTIFICATION",
        actorUserId: null,
        data: {
          source: "event_bus",
          event: event.type,
          reason:
            typeof data.reason === "string" ? data.reason : "delay_detected",
        } as Prisma.InputJsonValue,
      });
      break;
    }
    case CRM_EVENT_TYPES.STAGE_CHANGED:
    case CRM_EVENT_TYPES.CONTRACT_SIGNED:
    case CRM_EVENT_TYPES.PRODUCTION_STARTED:
    case CRM_EVENT_TYPES.DEAL_CREATED:
    default:
      break;
  }

  await dispatchDealAutomationTrigger({
    dealId,
    trigger: event.type,
    payload: {
      eventId: event.id,
      ...(data as Prisma.InputJsonObject),
    },
  });
  if (event.type === CRM_EVENT_TYPES.STAGE_CHANGED) {
    await dispatchDealAutomationTrigger({
      dealId,
      trigger: "deal.stage_changed",
      payload: {
        eventId: event.id,
        ...(data as Prisma.InputJsonObject),
      },
    });
  }

  await prisma.domainEvent.update({
    where: { id: event.id },
    data: { processedAt: new Date() },
  });
}

export async function publishCrmEvent(input: EventEnvelope): Promise<string | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    const created = await prisma.domainEvent.create({
      data: {
        type: input.type,
        dealId: input.dealId,
        payload: (input.payload ?? { dealId: input.dealId }) as Prisma.InputJsonValue,
        dedupeKey: input.dedupeKey,
      },
      select: { id: true },
    });
    await handleEvent(created.id);
    return created.id;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[publishCrmEvent]", error);
    }
    return null;
  }
}
