import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canEnterConstructorHub, mustBeAssignedForScope, resolveConstructorHubRole } from "@/features/production/ui/constructor-hub/constructor-hub.access";
import { getMockConstructorWorkspace } from "@/features/production/ui/constructor-hub/constructor-hub.mock";
import { mapFlowToConstructorWorkspace } from "@/features/production/ui/constructor-hub/constructor-hub.mapper";
import type { ConstructorWorkspace } from "@/features/production/ui/constructor-hub/constructor-hub.types";

type ConstructorHubResult =
  | { ok: true; workspace: ConstructorWorkspace }
  | { ok: false; reason: "access_denied" | "not_found" };

type DomainWorkspaceRow = Prisma.ConstructorWorkspaceGetPayload<{
  include: {
    deal: {
      select: {
        id: true;
        title: true;
        owner: { select: { name: true; email: true } };
        client: { select: { name: true } };
        constructorRoom: { select: { externalConstructorLabel: true } };
      };
    };
    productionFlow: {
      select: {
        id: true;
        number: true;
        title: true;
        chiefUser: { select: { name: true; email: true } };
      };
    };
    assignedConstructorUser: { select: { name: true; email: true } };
    techSpec: true;
    questions: {
      include: {
        createdByUser: { select: { name: true; email: true } };
      };
    };
    files: {
      include: {
        uploadedByUser: { select: { name: true; email: true } };
      };
    };
    versions: {
      include: {
        submittedByUser: { select: { name: true; email: true } };
      };
    };
    reviews: {
      include: {
        reviewedByUser: { select: { name: true; email: true } };
      };
    };
    checklistItems: true;
    zones: true;
    aiInsights: true;
    timeline: {
      include: {
        actorUser: { select: { name: true; email: true } };
      };
    };
  };
}>;

function mapDomainStatusToUi(
  status: string,
): ConstructorWorkspace["header"]["status"] {
  const map: Record<string, ConstructorWorkspace["header"]["status"]> = {
    NOT_ASSIGNED: "UNASSIGNED",
    ASSIGNED: "ASSIGNED",
    REVIEWING_INPUT: "REVIEWING",
    QUESTIONS_OPEN: "HAS_QUESTIONS",
    IN_PROGRESS: "IN_PROGRESS",
    DRAFT_UPLOADED: "DRAFT_UPLOADED",
    UNDER_REVIEW: "UNDER_REVIEW",
    REVISION_REQUESTED: "NEEDS_REWORK",
    APPROVED: "APPROVED",
    HANDED_OFF_TO_PRODUCTION: "HANDED_OFF",
    CANCELLED: "NEEDS_REWORK",
  };
  return map[status] ?? "IN_PROGRESS";
}

function mapDomainWorkspaceToUi(
  row: DomainWorkspaceRow,
  role: ConstructorWorkspace["currentUserRole"],
): ConstructorWorkspace {
  return {
    header: {
      flowId: row.productionFlowId ?? row.id,
      dealId: row.dealId,
      dealNumber: row.productionFlow?.number ?? row.id.slice(0, 8).toUpperCase(),
      projectName: row.productionFlow?.title ?? row.deal.title,
      clientName: row.deal.client.name,
      objectAddress: "Адрес уточняется",
      managerName: row.deal.owner.name ?? row.deal.owner.email,
      headOfProductionName:
        row.productionFlow?.chiefUser?.name ?? row.productionFlow?.chiefUser?.email ?? "Не назначен",
      assignedConstructorName:
        row.assignedConstructorUser?.name ??
        row.assignedConstructorUser?.email ??
        row.deal.constructorRoom?.externalConstructorLabel ??
        "Не назначен",
      deadlineAt: row.dueDate?.toISOString() ?? null,
      priority: row.priority,
      status: mapDomainStatusToUi(row.status),
    },
    stages: [
      { id: "1", label: "Назначение", state: row.status === "NOT_ASSIGNED" ? "ACTIVE" : "DONE" },
      { id: "2", label: "Подготовка", state: row.status === "ASSIGNED" ? "ACTIVE" : "DONE" },
      { id: "3", label: "Конструктор", state: ["IN_PROGRESS", "QUESTIONS_OPEN", "REVIEWING_INPUT"].includes(row.status) ? "ACTIVE" : "PENDING" },
      { id: "4", label: "Проверка", state: row.status === "UNDER_REVIEW" ? "ACTIVE" : "PENDING" },
      { id: "5", label: "Handoff", state: row.status === "HANDED_OFF_TO_PRODUCTION" ? "DONE" : "PENDING" },
    ],
    tasks: row.checklistItems.map((item) => ({
      id: item.id,
      title: item.title,
      done: item.isCompleted,
      dueAt: null,
    })),
    checklist: row.checklistItems.map((item) => ({
      id: item.id,
      label: item.title,
      done: item.isCompleted,
      required: item.isRequired,
    })),
    zoneProgress: row.zones.map((zone) => ({
      id: zone.id,
      zoneName: zone.zoneTitle,
      progressPercent: zone.progressPercent,
    })),
    techSections: [
      {
        id: row.techSpec?.id ?? "tech",
        title: "Общая информация",
        summary: "Структурированные разделы технического задания.",
        completionPercent: row.techSpec ? 100 : 0,
        updatedAt: row.techSpec?.updatedAt.toISOString() ?? null,
        details: [
          row.techSpec?.generalInfoJson ? "Общая информация заполнена" : "Общая информация не заполнена",
          row.techSpec?.approvedDataSnapshotJson ? "Approved snapshot зафиксирован" : "Нет approved snapshot",
        ],
      },
    ],
    questions: row.questions.map((question) => ({
      id: question.id,
      text: question.title,
      category: question.category === "DIMENSIONS" ? "SIZES" : question.category === "MATERIALS" ? "MATERIALS" : "PRODUCTION",
      addressedTo: "HEAD_OF_PRODUCTION",
      priority: question.priority === "CRITICAL" ? "CRITICAL" : question.priority === "HIGH" ? "HIGH" : question.priority === "LOW" ? "LOW" : "MEDIUM",
      status: question.status === "CLOSED" ? "CLOSED" : question.status === "ANSWERED" ? "IN_PROGRESS" : "OPEN",
      authorName: question.createdByUser?.name ?? question.createdByUser?.email ?? "Система",
      createdAt: question.createdAt.toISOString(),
      pinned: question.isPinned,
      answerPreview: question.answerText ?? null,
    })),
    files: row.files.map((file) => ({
      id: file.id,
      fileName: file.originalName,
      category: file.fileCategory === "MEASUREMENT" ? "MEASUREMENTS" : file.fileCategory === "CONSTRUCTOR_FINAL" ? "FINAL_FOR_PRODUCTION" : "OLD_VERSIONS",
      uploadedBy: file.uploadedByUser?.name ?? file.uploadedByUser?.email ?? "Команда",
      uploadedAt: file.createdAt.toISOString(),
      versionLabel: file.versionLabel ?? "—",
      extension: file.extension,
      previewUrl: file.fileUrl ?? null,
      downloadUrl: file.fileUrl ?? null,
      approved: file.isApproved,
      important: file.isImportant,
      archived: file.isArchived,
      mine: false,
      comments: [],
    })),
    versions: row.versions.map((version) => ({
      id: version.id,
      versionLabel: version.versionCode,
      type: version.type,
      uploadedAt: (version.submittedAt ?? version.createdAt).toISOString(),
      uploadedBy: version.submittedByUser?.name ?? version.submittedByUser?.email ?? "Конструктор",
      changeSummary: version.summary,
      approvalStatus:
        version.status === "APPROVED"
          ? "APPROVED"
          : version.status === "CHANGES_REQUESTED"
            ? "RETURNED"
            : version.status === "REJECTED"
              ? "REJECTED"
              : "PENDING",
    })),
    approvalReviews: row.reviews.map((review) => ({
      id: review.id,
      createdAt: review.createdAt.toISOString(),
      reviewerName: review.reviewedByUser?.name ?? review.reviewedByUser?.email ?? "Ревьюер",
      decision: review.decision === "APPROVE" ? "ACCEPTED" : review.decision === "RETURN_FOR_REVISION" ? "RETURNED" : "COMMENTED",
      severity: review.severity === "CRITICAL" ? "CRITICAL" : review.severity === "MAJOR" ? "MAJOR" : review.severity === "MINOR" ? "MINOR" : null,
      reason: review.comment ?? null,
      remarks: Array.isArray(review.remarksJson) ? review.remarksJson.map((item) => String(item)) : [],
    })),
    timeline: row.timeline.map((event) => ({
      id: event.id,
      type: "TECH_SPEC_UPDATED",
      title: event.title,
      description: event.description ?? "",
      actorName: event.actorUser?.name ?? event.actorUser?.email ?? "Система",
      createdAt: event.createdAt.toISOString(),
    })),
    aiAlerts: row.aiInsights.map((insight) => ({
      id: insight.id,
      level: insight.severity === "CRITICAL" ? "CRITICAL" : insight.severity === "HIGH" ? "WARNING" : "INFO",
      message: insight.description,
      section: insight.type === "RECOMMENDATION" ? "RECOMMENDATION" : insight.type === "MISSING_DATA" ? "MISSING" : insight.type === "OPEN_QUESTION" ? "CHECK" : "RISKS",
    })),
    approvedSummary: {
      lines: [
        {
          id: "snapshot",
          label: "Снимок согласованных данных",
          state: row.techSpec?.approvedDataSnapshotJson ? "APPROVED" : "MISSING",
          summary: row.techSpec?.approvedDataSnapshotJson ? "Данные зафиксированы в snapshot." : "Snapshot отсутствует.",
        },
      ],
    },
    contacts: [
      { id: "manager", roleLabel: "Менеджер", name: row.deal.owner.name ?? row.deal.owner.email, phone: null },
      {
        id: "head",
        roleLabel: "Нач. производства",
        name: row.productionFlow?.chiefUser?.name ?? row.productionFlow?.chiefUser?.email ?? "Не назначен",
        phone: null,
      },
      {
        id: "constructor",
        roleLabel: "Конструктор",
        name:
          row.assignedConstructorUser?.name ??
          row.assignedConstructorUser?.email ??
          row.deal.constructorRoom?.externalConstructorLabel ??
          "Не назначен",
        phone: null,
      },
    ],
    communication: [],
    currentUserRole: role,
  };
}

export async function getConstructorHubWorkspace(input: {
  id: string;
  session: Session;
}): Promise<ConstructorHubResult> {
  const user = input.session.user;
  if (!canEnterConstructorHub(user)) {
    return { ok: false, reason: "access_denied" };
  }

  const domainWorkspace = await prisma.constructorWorkspace.findFirst({
    where: {
      OR: [{ id: input.id }, { dealId: input.id }, { productionFlowId: input.id }],
    },
    include: {
      deal: {
        select: {
          id: true,
          title: true,
          owner: { select: { name: true, email: true } },
          client: { select: { name: true } },
          constructorRoom: { select: { externalConstructorLabel: true } },
        },
      },
      productionFlow: {
        select: {
          id: true,
          number: true,
          title: true,
          chiefUser: { select: { name: true, email: true } },
        },
      },
      assignedConstructorUser: { select: { name: true, email: true } },
      techSpec: true,
      questions: {
        orderBy: { createdAt: "desc" },
        include: {
          createdByUser: { select: { name: true, email: true } },
        },
      },
      files: {
        orderBy: { createdAt: "desc" },
        include: {
          uploadedByUser: { select: { name: true, email: true } },
        },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          submittedByUser: { select: { name: true, email: true } },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        include: {
          reviewedByUser: { select: { name: true, email: true } },
        },
      },
      checklistItems: { orderBy: { sortOrder: "asc" } },
      zones: { orderBy: { createdAt: "asc" } },
      aiInsights: { orderBy: { createdAt: "desc" } },
      timeline: {
        orderBy: { createdAt: "desc" },
        include: {
          actorUser: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (domainWorkspace) {
    if (mustBeAssignedForScope(user) && domainWorkspace.assignedConstructorUserId !== user.id) {
      return { ok: false, reason: "access_denied" };
    }
    const role = resolveConstructorHubRole(user);
    return {
      ok: true,
      workspace: mapDomainWorkspaceToUi(domainWorkspace, role),
    };
  }

  const flow = await prisma.productionFlow.findFirst({
    where: { OR: [{ id: input.id }, { dealId: input.id }] },
    include: {
      deal: {
        select: {
          id: true,
          title: true,
          owner: { select: { name: true, email: true } },
          productionManager: { select: { name: true, email: true } },
          client: { select: { name: true } },
          workspaceMeta: true,
          controlMeasurementJson: true,
          constructorRoom: {
            select: {
              assignedUserId: true,
              externalConstructorLabel: true,
              status: true,
            },
          },
        },
      },
      chiefUser: { select: { name: true, email: true } },
      tasks: {
        orderBy: { createdAt: "desc" },
        include: {
          assigneeUser: { select: { id: true, name: true, email: true } },
        },
        take: 80,
      },
      questions: { orderBy: { createdAt: "desc" }, take: 100 },
      filePackages: { orderBy: { uploadedAt: "desc" }, include: { files: true }, take: 30 },
      approvals: { orderBy: { createdAt: "desc" }, take: 30 },
      events: { orderBy: { createdAt: "desc" }, take: 80 },
      risks: {
        where: { resolvedAt: null },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 30,
      },
      aiInsights: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!flow) {
    return { ok: false, reason: "not_found" };
  }

  if (mustBeAssignedForScope(user)) {
    const assignedByTask = flow.tasks.some(
      (task) => task.type === "CONSTRUCTOR" && task.assigneeUserId === user.id,
    );
    const assignedByRoom = flow.deal.constructorRoom?.assignedUserId === user.id;
    if (!assignedByTask && !assignedByRoom) {
      return { ok: false, reason: "access_denied" };
    }
  }

  const role = resolveConstructorHubRole(user);
  return {
    ok: true,
    workspace: mapFlowToConstructorWorkspace(flow, role),
  };
}

export function getConstructorHubWorkspaceDemo(input: { id: string; session: Session }): ConstructorWorkspace {
  return getMockConstructorWorkspace(input.id, resolveConstructorHubRole(input.session.user));
}
