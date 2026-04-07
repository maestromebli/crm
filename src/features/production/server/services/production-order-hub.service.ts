import { prisma } from "@/lib/prisma";
import { computeStepStates, getStepLabel } from "./production-step.service";
import type {
  ProductionAIInsightType,
  ProductionFlowStatus,
  ProductionOrderHubView,
  ProductionQuestionStatus,
  ProductionRiskSeverity,
  ProductionStepKey,
  ProductionStepState,
  ProductionTaskStatus,
  ProductionTaskType,
} from "../../types/production";
import { getDemoOrderHubView } from "../demo/production-demo";

export async function getProductionOrderHubView(flowId: string): Promise<ProductionOrderHubView | null> {
  const flow = await prisma.productionFlow.findUnique({
    where: { id: flowId },
    include: {
      chiefUser: { select: { name: true, email: true } },
      steps: { orderBy: { sortOrder: "asc" } },
      risks: { where: { resolvedAt: null }, orderBy: [{ severity: "desc" }, { createdAt: "desc" }] },
      questions: { orderBy: { createdAt: "desc" }, take: 30 },
      filePackages: {
        orderBy: { uploadedAt: "desc" },
        include: { files: true },
        take: 10,
      },
      tasks: { orderBy: { createdAt: "desc" }, include: { assigneeUser: { select: { name: true, email: true } } } },
      aiInsights: { orderBy: { createdAt: "desc" }, take: 20 },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!flow) return getDemoOrderHubView(flowId);

  const blockedKeys = flow.steps
    .filter((step) => step.state === "BLOCKED")
    .map((step) => step.key as ProductionStepKey);
  const states = computeStepStates(flow.currentStepKey as ProductionStepKey, blockedKeys);
  const stateByKey = new Map(states.map((state) => [state.key, state]));
  const steps = flow.steps.map((step) => {
    const key = step.key as ProductionStepKey;
    const mapped = stateByKey.get(key);
    return {
      key,
      label: mapped?.label ?? getStepLabel(key),
      state: (mapped?.state ?? step.state) as ProductionStepState,
      completedAt: step.completedAt?.toISOString() ?? null,
    };
  });

  const view: ProductionOrderHubView = {
    flow: {
      id: flow.id,
      number: flow.number,
      title: flow.title,
      clientName: flow.clientName,
      status: flow.status as ProductionFlowStatus,
      currentStepKey: flow.currentStepKey as ProductionStepKey,
      readinessPercent: flow.readinessPercent,
      riskScore: flow.riskScore,
      dueDate: flow.dueDate?.toISOString() ?? null,
      chiefName: flow.chiefUser?.name ?? flow.chiefUser?.email ?? null,
      constructorName: flow.constructorName,
      constructorMode: flow.constructorMode,
      constructorWorkspaceUrl: flow.constructorWorkspaceUrl,
      telegramThreadUrl: flow.telegramThreadUrl,
    },
    steps,
    blockers: flow.risks.map((risk) => ({
      id: risk.id,
      severity: risk.severity as ProductionRiskSeverity,
      title: risk.title,
      description: risk.description,
    })),
    questions: flow.questions.map((question) => ({
      id: question.id,
      authorName: question.authorName,
      source: question.source,
      text: question.text,
      status: question.status as ProductionQuestionStatus,
      createdAt: question.createdAt.toISOString(),
    })),
    filePackages: flow.filePackages.map((pkg) => ({
      id: pkg.id,
      packageName: pkg.packageName,
      versionLabel: pkg.versionLabel,
      fileCount: pkg.files.length,
      note: pkg.note,
      uploadedAt: pkg.uploadedAt.toISOString(),
      uploadedByName: pkg.uploadedByName,
      validationPassed: pkg.validationPassed,
      approvalStatus: pkg.approvalStatus ?? null,
    })),
    tasks: flow.tasks.map((task) => ({
      id: task.id,
      type: task.type as ProductionTaskType,
      title: task.title,
      status: task.status as ProductionTaskStatus,
      assigneeName: task.assigneeUser?.name ?? task.assigneeUser?.email ?? null,
      dueDate: task.dueDate?.toISOString() ?? null,
    })),
    insights: flow.aiInsights.map((insight) => ({
      id: insight.id,
      type: insight.type as ProductionAIInsightType,
      title: insight.title,
      description: insight.description,
      severity: (insight.severity ?? null) as ProductionRiskSeverity | null,
      recommendedAction: insight.recommendedAction ?? null,
    })),
    timeline: flow.events.map((event) => ({
      id: event.id,
      type: event.type,
      actorName: event.actorName,
      title: event.title,
      description: event.description ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
  };
  return view;
}
