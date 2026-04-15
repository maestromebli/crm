import type { Prisma } from "@prisma/client";
import type {
  ConstructorAIAlert,
  ConstructorApprovalReview,
  ConstructorFile,
  ConstructorHubStatus,
  ConstructorQuestion,
  ConstructorWorkspace,
} from "./constructor-hub.types";
import { getMockConstructorWorkspace } from "./constructor-hub.mock";

type FlowWithRelations = Prisma.ProductionFlowGetPayload<{
  include: {
    deal: {
      select: {
        id: true;
        title: true;
        owner: { select: { name: true; email: true } };
        productionManager: { select: { name: true; email: true } };
        client: { select: { name: true } };
        workspaceMeta: true;
        controlMeasurementJson: true;
        constructorRoom: {
          select: {
            assignedUserId: true;
            externalConstructorLabel: true;
            status: true;
          };
        };
      };
    };
    chiefUser: { select: { name: true; email: true } };
    tasks: {
      orderBy: { createdAt: "desc" };
      include: { assigneeUser: { select: { id: true; name: true; email: true } } };
      take: 80;
    };
    questions: { orderBy: { createdAt: "desc" }; take: 100 };
    filePackages: {
      orderBy: { uploadedAt: "desc" };
      include: { files: true };
      take: 30;
    };
    approvals: { orderBy: { createdAt: "desc" }; take: 30 };
    events: { orderBy: { createdAt: "desc" }; take: 80 };
    risks: { where: { resolvedAt: null }; orderBy: [{ severity: "desc" }, { createdAt: "desc" }]; take: 30 };
    aiInsights: { orderBy: { createdAt: "desc" }; take: 20 };
  };
}>;

function mapStatus(flow: FlowWithRelations): ConstructorHubStatus {
  if (!flow.constructorName) return "UNASSIGNED";
  if (flow.currentStepKey === "CONSTRUCTOR_ASSIGNED") return "ASSIGNED";
  if (flow.currentStepKey === "CONSTRUCTOR_IN_PROGRESS") return "IN_PROGRESS";
  if (flow.currentStepKey === "FILES_PACKAGE_UPLOADED") return "DRAFT_UPLOADED";
  if (flow.currentStepKey === "FILES_VALIDATED") return "UNDER_REVIEW";
  if (flow.currentStepKey === "APPROVED_BY_CHIEF") return "APPROVED";
  if (flow.currentStepKey === "TASKS_DISTRIBUTED") return "HANDED_OFF";
  if (flow.openQuestionsCount > 0) return "HAS_QUESTIONS";
  if (flow.status === "BLOCKED") return "NEEDS_REWORK";
  return "REVIEWING";
}

function mapQuestions(flow: FlowWithRelations): ConstructorQuestion[] {
  return flow.questions.map((question) => ({
    id: question.id,
    text: question.text,
    category: "PRODUCTION",
    addressedTo: question.source === "INTERNAL" ? "HEAD_OF_PRODUCTION" : "MANAGER",
    priority: question.status === "OPEN" ? "HIGH" : "MEDIUM",
    status:
      question.status === "OPEN"
        ? "OPEN"
        : question.status === "ANSWERED"
          ? "CLOSED"
          : "IN_PROGRESS",
    authorName: question.authorName,
    createdAt: question.createdAt.toISOString(),
    pinned: question.status === "OPEN",
    answerPreview: null,
  }));
}

function mapFiles(flow: FlowWithRelations): ConstructorFile[] {
  return flow.filePackages.flatMap((pkg) =>
    pkg.files.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      category: pkg.approvalStatus === "APPROVED" ? "FINAL_FOR_PRODUCTION" : "OLD_VERSIONS",
      uploadedBy: pkg.uploadedByName ?? "Команда",
      uploadedAt: file.createdAt.toISOString(),
      versionLabel: pkg.versionLabel,
      extension: file.fileType ?? "file",
      previewUrl: file.fileUrl ?? null,
      downloadUrl: file.fileUrl ?? null,
      approved: pkg.approvalStatus === "APPROVED",
      important: pkg.approvalStatus === "APPROVED" || pkg.validationPassed,
      archived: pkg.approvalStatus === "REJECTED",
      mine: false,
      comments: [],
    })),
  );
}

function mapReviews(flow: FlowWithRelations): ConstructorApprovalReview[] {
  return flow.approvals.map((item) => ({
    id: item.id,
    createdAt: item.createdAt.toISOString(),
    reviewerName: item.actorName ?? "Ревьюер",
    decision:
      item.status === "APPROVED"
        ? "ACCEPTED"
        : item.status === "REJECTED"
          ? "RETURNED"
          : "COMMENTED",
    severity: item.status === "REJECTED" ? "MAJOR" : null,
    reason: item.reason ?? null,
    remarks: item.reason ? [item.reason] : [],
  }));
}

function mapAiAlerts(flow: FlowWithRelations): ConstructorAIAlert[] {
  const alerts: ConstructorAIAlert[] = [];
  for (const risk of flow.risks) {
    alerts.push({
      id: `risk-${risk.id}`,
      level: risk.severity === "CRITICAL" ? "CRITICAL" : "WARNING",
      section: "RISKS",
      message: risk.title,
    });
  }
  for (const insight of flow.aiInsights) {
    alerts.push({
      id: `insight-${insight.id}`,
      level: insight.severity === "CRITICAL" ? "CRITICAL" : insight.severity === "HIGH" ? "WARNING" : "INFO",
      section:
        insight.type === "RISK"
          ? "RISKS"
          : insight.type === "WARNING"
            ? "CHECK"
            : insight.type === "NEXT_ACTION"
              ? "RECOMMENDATION"
              : "MISSING",
      message: insight.description,
    });
  }
  return alerts.slice(0, 12);
}

export function mapFlowToConstructorWorkspace(
  flow: FlowWithRelations,
  role: ConstructorWorkspace["currentUserRole"],
): ConstructorWorkspace {
  const base = getMockConstructorWorkspace(flow.id, role);
  const ownerLabel = flow.deal.owner.name?.trim() || flow.deal.owner.email;
  const prodLabel = flow.deal.productionManager?.name?.trim() || flow.deal.productionManager?.email || "Не назначен";
  const constructorLabel =
    flow.deal.constructorRoom?.externalConstructorLabel ??
    flow.constructorName ??
    base.header.assignedConstructorName;

  return {
    ...base,
    header: {
      ...base.header,
      flowId: flow.id,
      dealId: flow.deal.id,
      dealNumber: flow.number,
      projectName: flow.title || flow.deal.title,
      clientName: flow.clientName || flow.deal.client.name,
      objectAddress: "Адрес уточняется",
      managerName: ownerLabel,
      headOfProductionName: flow.chiefUser?.name ?? flow.chiefUser?.email ?? prodLabel,
      assignedConstructorName: constructorLabel,
      deadlineAt: flow.dueDate?.toISOString() ?? base.header.deadlineAt,
      priority: flow.priority,
      status: mapStatus(flow),
    },
    tasks:
      flow.tasks.length > 0
        ? flow.tasks.slice(0, 8).map((task) => ({
            id: task.id,
            title: task.title,
            done: task.status === "DONE",
            dueAt: task.dueDate?.toISOString() ?? null,
          }))
        : base.tasks,
    questions: flow.questions.length > 0 ? mapQuestions(flow) : base.questions,
    files: flow.filePackages.length > 0 ? mapFiles(flow) : base.files,
    versions:
      flow.filePackages.length > 0
        ? flow.filePackages.map((pkg) => ({
            id: pkg.id,
            versionLabel: pkg.versionLabel,
            type: pkg.approvalStatus === "APPROVED" ? "FINAL" : pkg.validationPassed ? "REVIEW" : "DRAFT",
            uploadedAt: pkg.uploadedAt.toISOString(),
            uploadedBy: pkg.uploadedByName ?? "Команда",
            changeSummary: pkg.note ?? "Изменения не описаны.",
            approvalStatus:
              pkg.approvalStatus === "APPROVED"
                ? "APPROVED"
                : pkg.approvalStatus === "REJECTED"
                  ? "RETURNED"
                  : "PENDING",
          }))
        : base.versions,
    approvalReviews: flow.approvals.length > 0 ? mapReviews(flow) : base.approvalReviews,
    timeline:
      flow.events.length > 0
        ? flow.events.map((event) => ({
            id: event.id,
            type: "TECH_SPEC_UPDATED",
            title: event.title,
            description: event.description ?? "Без описания",
            actorName: event.actorName ?? "Система",
            createdAt: event.createdAt.toISOString(),
          }))
        : base.timeline,
    aiAlerts: flow.risks.length + flow.aiInsights.length > 0 ? mapAiAlerts(flow) : base.aiAlerts,
    contacts: [
      { id: "manager", roleLabel: "Менеджер", name: ownerLabel, phone: null },
      { id: "head", roleLabel: "Нач. производства", name: flow.chiefUser?.name ?? flow.chiefUser?.email ?? "Не назначен", phone: null },
      { id: "pm", roleLabel: "Проджект (производство)", name: prodLabel, phone: null },
      { id: "constructor", roleLabel: "Конструктор", name: constructorLabel, phone: null },
      ...base.contacts.filter((item) => item.roleLabel === "Клиент"),
    ],
    currentUserRole: role,
  };
}
