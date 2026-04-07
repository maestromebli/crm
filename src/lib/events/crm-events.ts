import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendActivityLog } from "@/lib/deal-api/audit";
import { seedDealPaymentPlan7030 } from "@/lib/deals/payment-milestones";
import {
  dispatchDealAutomationTrigger,
  dispatchLeadAutomationTrigger,
} from "@/lib/automation/dispatch";
import { moneyFromDb } from "@/lib/finance/money";
import { CANONICAL_EVENT_TYPES } from "./event-catalog";

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

/**
 * Core (dynamic-layer friendly) event names for entity timeline.
 * Keep them additive and backward-compatible with dotted legacy triggers.
 */
export const CORE_EVENT_TYPES = {
  LEAD_CREATED: CANONICAL_EVENT_TYPES.LEAD_CREATED,
  STATUS_CHANGED: CANONICAL_EVENT_TYPES.STATUS_CHANGED,
  FILE_UPLOADED: CANONICAL_EVENT_TYPES.FILE_UPLOADED,
  ESTIMATE_CREATED: CANONICAL_EVENT_TYPES.ESTIMATE_CREATED,
  QUOTE_SENT: CANONICAL_EVENT_TYPES.QUOTE_SENT,
  PAYMENT_RECEIVED: CANONICAL_EVENT_TYPES.PAYMENT_RECEIVED,
  INVOICE_CREATED: CANONICAL_EVENT_TYPES.INVOICE_CREATED,
  CONTRACT_SIGNED: CANONICAL_EVENT_TYPES.CONTRACT_SIGNED,
  SENT_TO_PRODUCTION: CANONICAL_EVENT_TYPES.SENT_TO_PRODUCTION,
  POLICY_BLOCKER_RAISED: CANONICAL_EVENT_TYPES.POLICY_BLOCKER_RAISED,
} as const;

export type CoreEventType = (typeof CORE_EVENT_TYPES)[keyof typeof CORE_EVENT_TYPES];

export type EventEntityType =
  | "LEAD"
  | "DEAL"
  | "CLIENT"
  | "CONTACT"
  | "ESTIMATE"
  | "QUOTE"
  | "CONTRACT"
  | "PAYMENT"
  | "TASK"
  | "FILE"
  | "PRODUCTION";

type EventEnvelope = {
  type: CrmEventType;
  dealId: string;
  payload?: Prisma.InputJsonValue;
  dedupeKey?: string;
};

type EventEnvelopeV2 = {
  type: string;
  entityType: EventEntityType;
  entityId: string;
  payload?: Prisma.InputJsonValue;
  dedupeKey?: string;
  userId?: string | null;
  dealId?: string | null;
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
  const entityType =
    event.entityType ??
    (typeof data.entityType === "string" ? data.entityType : null);
  const entityId =
    event.entityId ??
    (typeof data.entityId === "string" ? data.entityId : null);
  const dealId = event.dealId ?? (typeof data.dealId === "string" ? data.dealId : null);
  if (!dealId) {
    if (entityType === "LEAD" && entityId) {
      await dispatchLeadAutomationTrigger({
        leadId: entityId,
        trigger: event.type,
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
      if (deal?.value != null && moneyFromDb(deal.value) > 0) {
        const hasPlan = await prisma.dealPaymentPlan.findUnique({
          where: { dealId },
          select: { id: true },
        });
        if (!hasPlan) {
          await seedDealPaymentPlan7030(prisma, {
            dealId,
            total: moneyFromDb(deal.value),
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
  return publishEntityEvent({
    type: input.type,
    entityType: "DEAL",
    entityId: input.dealId,
    payload: input.payload,
    dedupeKey: input.dedupeKey,
    dealId: input.dealId,
  });
}

/**
 * Universal entity event API (non-destructive): keeps `DomainEvent` storage unchanged,
 * but enriches payload with `entityType/entityId/userId` so timeline/smart panels can
 * consume one event contract across Lead/Deal and future entities.
 */
export async function publishEntityEvent(
  input: EventEnvelopeV2,
): Promise<string | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    const payload = payloadObject(input.payload);
    const eventPayload = {
      ...payload,
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.userId ?? null,
    } as Prisma.InputJsonValue;

    const resolvedDealId =
      input.dealId ??
      (input.entityType === "DEAL" ? input.entityId : null);

    let created: { id: string };
    try {
      created = await prisma.domainEvent.create({
        data: {
          type: input.type,
          dealId: resolvedDealId,
          payload: eventPayload,
          dedupeKey: input.dedupeKey,
          // Optional columns after migration 20260414130000_domain_event_entity_scope.
          entityType: input.entityType,
          entityId: input.entityId,
          userId: input.userId ?? null,
        } as Prisma.DomainEventCreateInput & {
          entityType?: string | null;
          entityId?: string | null;
          userId?: string | null;
        },
        select: { id: true },
      });
    } catch (firstError) {
      const message = firstError instanceof Error ? firstError.message : String(firstError);
      const entityColumnsMissing =
        /entityType|entityId|userId/i.test(message) &&
        /column|unknown argument|does not exist/i.test(message);
      if (!entityColumnsMissing) throw firstError;
      created = await prisma.domainEvent.create({
        data: {
          type: input.type,
          dealId: resolvedDealId,
          payload: eventPayload,
          dedupeKey: input.dedupeKey,
        },
        select: { id: true },
      });
    }
    await handleEvent(created.id);
    return created.id;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[publishCrmEvent]", error);
    }
    return null;
  }
}
