import { prisma } from "@/lib/prisma";
import { canAccessLead, canAccessOwner, resolveAccessContext } from "@/lib/authz/data-scope";
import type { AiV2ActorContext, AiV2ContextName, AiV2ContextSnapshot } from "../core/types";
import {
  detectDealMissingData,
  detectLeadMissingData,
} from "@/lib/ai/context-builders/missing-data-detector";
import { calcLeadContactSla } from "@/lib/health/sla-monitor";

type BuildContextInput = {
  actor: AiV2ActorContext;
  context: AiV2ContextName;
  leadId?: string;
  dealId?: string;
};

export async function buildAiV2ContextSnapshot(
  input: BuildContextInput,
): Promise<AiV2ContextSnapshot | null> {
  const access = await resolveAccessContext(prisma, {
    id: input.actor.userId,
    role: input.actor.realRole,
  });

  if (input.context === "lead" && input.leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: input.leadId },
      select: {
        id: true,
        title: true,
        ownerId: true,
        stage: { select: { name: true } },
        contactName: true,
        phone: true,
        email: true,
        qualification: true,
        createdAt: true,
        lastActivityAt: true,
        updatedAt: true,
      },
    });
    if (!lead || !canAccessLead(access, { id: lead.id, ownerId: lead.ownerId })) {
      return null;
    }

    const [overdueTasks, attachments, messages] = await Promise.all([
      prisma.task.count({
        where: {
          entityType: "LEAD",
          entityId: lead.id,
          status: { in: ["OPEN", "IN_PROGRESS"] },
          dueAt: { lt: new Date() },
        },
      }),
      prisma.attachment.count({
        where: {
          entityType: "LEAD",
          entityId: lead.id,
          deletedAt: null,
        },
      }),
      prisma.leadMessage.count({ where: { leadId: lead.id } }),
    ]);

    const missingData = detectLeadMissingData({
      contactName: lead.contactName,
      phone: lead.phone,
      email: lead.email,
      qualification: lead.qualification,
    });
    const sla = calcLeadContactSla({
      createdAt: lead.createdAt,
      lastActivityAt: lead.lastActivityAt,
      leadMessagesCount: messages,
      slaHours: 24,
    });

    return {
      context: "lead",
      entityType: "LEAD",
      entityId: lead.id,
      title: lead.title,
      ownerId: lead.ownerId,
      flags: {
        overdueTasks,
        missingFiles: attachments > 0 ? 0 : 1,
        missingDataCount: missingData.length,
        pendingPayments: 0,
        silenceHours: lead.updatedAt
          ? Math.max(0, Math.round((Date.now() - lead.updatedAt.getTime()) / 36e5))
          : 0,
        slaBreached: sla.breached,
        slaOverdueHours: sla.overdueHours,
        openConstructorQuestions: 0,
      },
      timelineFacts: [
        `Стадія ліда: ${lead.stage.name}`,
        `Повідомлень у стрічці: ${messages}`,
        `Файлів: ${attachments}`,
        `SLA першого контакту: ${sla.breached ? `порушено на ${sla.overdueHours} год` : "ok"}`,
        `Missing data: ${missingData.length}`,
      ],
    };
  }

  if (
    (input.context === "deal" ||
      input.context === "finance" ||
      input.context === "production" ||
      input.context === "procurement") &&
    input.dealId
  ) {
    const deal = await prisma.deal.findUnique({
      where: { id: input.dealId },
      select: {
        id: true,
        title: true,
        ownerId: true,
        stage: { select: { name: true } },
        expectedCloseDate: true,
        value: true,
        controlMeasurementJson: true,
        updatedAt: true,
      },
    });
    if (!deal || !canAccessOwner(access, deal.ownerId)) {
      return null;
    }

    const [overdueTasks, paymentsPending, ctorQuestions, filesCount] = await Promise.all([
      prisma.task.count({
        where: {
          entityType: "DEAL",
          entityId: deal.id,
          status: { in: ["OPEN", "IN_PROGRESS"] },
          dueAt: { lt: new Date() },
        },
      }),
      prisma.moneyTransaction.count({
        where: {
          dealId: deal.id,
          type: "INCOME",
          status: "PENDING",
        },
      }),
      prisma.dealConstructorRoomMessage.count({
        where: {
          room: { dealId: deal.id },
          author: "INTERNAL",
        },
      }),
      prisma.attachment.count({
        where: {
          entityType: "DEAL",
          entityId: deal.id,
          deletedAt: null,
        },
      }),
    ]);

    const missingData = detectDealMissingData({
      expectedCloseDate: deal.expectedCloseDate,
      value: deal.value,
      controlMeasurementJson: deal.controlMeasurementJson,
    });

    return {
      context: input.context,
      entityType: "DEAL",
      entityId: deal.id,
      title: deal.title,
      ownerId: deal.ownerId,
      flags: {
        overdueTasks,
        missingFiles: filesCount > 0 ? 0 : 1,
        missingDataCount: missingData.length,
        pendingPayments: paymentsPending,
        silenceHours: deal.updatedAt
          ? Math.max(0, Math.round((Date.now() - deal.updatedAt.getTime()) / 36e5))
          : 0,
        slaBreached: false,
        slaOverdueHours: 0,
        openConstructorQuestions: ctorQuestions,
      },
      timelineFacts: [
        `Стадія угоди: ${deal.stage.name}`,
        `Прострочені задачі: ${overdueTasks}`,
        `Невирішені питання конструктора: ${ctorQuestions}`,
        `Очікуючі платежі: ${paymentsPending}`,
        `Missing data: ${missingData.length}`,
      ],
    };
  }

  if (input.context === "finance") {
    const ownerFilter =
      access.teamOwnerIdSet === null ? undefined : { in: [...access.teamOwnerIdSet] };
    const [pendingPayments, overduePayments, riskyDeals] = await Promise.all([
      prisma.moneyTransaction.count({
        where: {
          type: "INCOME",
          status: "PENDING",
          ...(ownerFilter ? { deal: { ownerId: ownerFilter } } : {}),
        },
      }),
      prisma.moneyTransaction.count({
        where: {
          type: "INCOME",
          status: "PENDING",
          dueDate: { lt: new Date() },
          ...(ownerFilter ? { deal: { ownerId: ownerFilter } } : {}),
        },
      }),
      prisma.deal.count({
        where: {
          ...(ownerFilter ? { ownerId: ownerFilter } : {}),
          status: "OPEN",
        },
      }),
    ]);

    return {
      context: "finance",
      entityType: "DASHBOARD",
      entityId: "finance-dashboard",
      title: "Фінансовий контур CRM",
      flags: {
        overdueTasks: 0,
        missingFiles: 0,
        missingDataCount: 0,
        pendingPayments,
        silenceHours: 0,
        slaBreached: false,
        slaOverdueHours: 0,
        openConstructorQuestions: 0,
      },
      timelineFacts: [
        `Очікувані надходження: ${pendingPayments}`,
        `Прострочені очікувані оплати: ${overduePayments}`,
        `Активні угоди у фінансовому контурі: ${riskyDeals}`,
      ],
    };
  }

  if (input.context === "production") {
    const ownerFilter =
      access.teamOwnerIdSet === null ? undefined : { in: [...access.teamOwnerIdSet] };
    const [highRiskFlows, blockedFlows, openCtorQuestions] = await Promise.all([
      prisma.productionFlow.count({
        where: {
          riskScore: { gte: 70 },
          ...(ownerFilter ? { deal: { ownerId: ownerFilter } } : {}),
        },
      }),
      prisma.productionFlow.count({
        where: {
          status: "BLOCKED",
          ...(ownerFilter ? { deal: { ownerId: ownerFilter } } : {}),
        },
      }),
      prisma.dealConstructorRoomMessage.count({
        where: {
          author: "INTERNAL",
          room: ownerFilter ? { deal: { ownerId: ownerFilter } } : undefined,
        },
      }),
    ]);

    return {
      context: "production",
      entityType: "DASHBOARD",
      entityId: "production-dashboard",
      title: "Виробничий контур CRM",
      flags: {
        overdueTasks: blockedFlows,
        missingFiles: 0,
        missingDataCount: 0,
        pendingPayments: 0,
        silenceHours: 0,
        slaBreached: false,
        slaOverdueHours: 0,
        openConstructorQuestions: openCtorQuestions,
      },
      timelineFacts: [
        `Потоки з високим ризиком: ${highRiskFlows}`,
        `Заблоковані потоки: ${blockedFlows}`,
        `Відкриті питання конструктора: ${openCtorQuestions}`,
      ],
    };
  }

  if (input.context === "procurement") {
    const ownerFilter =
      access.teamOwnerIdSet === null ? undefined : { in: [...access.teamOwnerIdSet] };
    const [openRequests, overdueRequests, openOrders] = await Promise.all([
      prisma.procurementRequest.count({
        where: {
          status: { notIn: ["DONE", "CANCELLED"] },
          ...(ownerFilter ? { deal: { ownerId: ownerFilter } } : {}),
        },
      }),
      prisma.procurementRequest.count({
        where: {
          status: { notIn: ["DONE", "CANCELLED"] },
          neededByDate: { lt: new Date() },
          ...(ownerFilter ? { deal: { ownerId: ownerFilter } } : {}),
        },
      }),
      prisma.purchaseOrder.count({
        where: {
          status: { notIn: ["DONE", "CLOSED", "CANCELLED"] },
          ...(ownerFilter ? { deal: { ownerId: ownerFilter } } : {}),
        },
      }),
    ]);

    return {
      context: "procurement",
      entityType: "DASHBOARD",
      entityId: "procurement-dashboard",
      title: "Закупівельний контур CRM",
      flags: {
        overdueTasks: overdueRequests,
        missingFiles: 0,
        missingDataCount: 0,
        pendingPayments: openOrders,
        silenceHours: 0,
        slaBreached: false,
        slaOverdueHours: 0,
        openConstructorQuestions: 0,
      },
      timelineFacts: [
        `Активні заявки закупівлі: ${openRequests}`,
        `Прострочені заявки: ${overdueRequests}`,
        `Відкриті замовлення постачальникам: ${openOrders}`,
      ],
    };
  }

  if (input.context === "dashboard") {
    const ownerFilter =
      access.teamOwnerIdSet === null ? undefined : { in: [...access.teamOwnerIdSet] };
    const [overdueTasks, overduePayments, criticalProduction] = await Promise.all([
      prisma.task.count({
        where: {
          status: { in: ["OPEN", "IN_PROGRESS"] },
          dueAt: { lt: new Date() },
          ...(ownerFilter ? { assigneeId: ownerFilter } : {}),
        },
      }),
      prisma.moneyTransaction.count({
        where: {
          type: "INCOME",
          status: "PENDING",
          dueDate: { lt: new Date() },
          ...(ownerFilter ? { deal: { ownerId: ownerFilter } } : {}),
        },
      }),
      prisma.productionFlow.count({
        where: {
          riskScore: { gte: 60 },
          ...(ownerFilter ? { deal: { ownerId: ownerFilter } } : {}),
        },
      }),
    ]);

    return {
      context: "dashboard",
      entityType: "DASHBOARD",
      entityId: "dashboard",
      title: "Операційна панель AI V2",
      flags: {
        overdueTasks,
        missingFiles: 0,
        missingDataCount: 0,
        pendingPayments: overduePayments,
        silenceHours: 0,
        slaBreached: false,
        slaOverdueHours: 0,
        openConstructorQuestions: criticalProduction,
      },
      timelineFacts: [
        `Прострочені задачі команди: ${overdueTasks}`,
        `Прострочені оплати: ${overduePayments}`,
        `Високий ризик виробництва: ${criticalProduction}`,
      ],
    };
  }

  return null;
}
