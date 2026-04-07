import { prisma } from "@/lib/prisma";
import { computeStepStates } from "./production-step.service";
import type { ProductionOrderHubView } from "../../types/production";
import { getDemoOrderHubView } from "../demo/production-demo";

export async function getProductionOrderHubView(flowId: string): Promise<ProductionOrderHubView | null> {
  const productionFlowDelegate = (
    prisma as unknown as {
      productionFlow?: {
        findUnique: (args: unknown) => Promise<
          | {
              id: string;
              number: string;
              title: string;
              clientName: string;
              status: string;
              currentStepKey: string;
              readinessPercent: number;
              riskScore: number;
              dueDate: Date | null;
              constructorName: string | null;
              constructorMode: "INTERNAL" | "OUTSOURCE" | null;
              constructorWorkspaceUrl: string | null;
              telegramThreadUrl: string | null;
              chiefUser: { name: string | null; email: string } | null;
              steps: Array<{ key: string; state: string; completedAt: Date | null }>;
              risks: Array<{ id: string; severity: string; title: string; description: string }>;
              questions: Array<{
                id: string;
                authorName: string;
                source: string;
                text: string;
                status: string;
                createdAt: Date;
              }>;
              filePackages: Array<{
                id: string;
                packageName: string;
                versionLabel: string;
                note: string | null;
                uploadedAt: Date;
                uploadedByName: string | null;
                validationPassed: boolean;
                approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
                files: Array<{ id: string }>;
              }>;
              tasks: Array<{
                id: string;
                type: string;
                title: string;
                status: string;
                dueDate: Date | null;
                assigneeUser: { name: string | null; email: string } | null;
              }>;
              aiInsights: Array<{
                id: string;
                type: string;
                title: string;
                description: string;
                severity: string | null;
                recommendedAction: string | null;
              }>;
              events: Array<{
                id: string;
                type: string;
                actorName: string | null;
                title: string;
                description: string | null;
                createdAt: Date;
              }>;
            }
          | null
        >;
      };
    }
  ).productionFlow;

  if (!productionFlowDelegate) {
    return getDemoOrderHubView(flowId);
  }

  const flow = await productionFlowDelegate.findUnique({
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

  const states = computeStepStates(
    flow.currentStepKey,
    flow.steps.filter((step) => step.state === "BLOCKED").map((step) => step.key),
  );
  const stateByKey = new Map(states.map((state) => [state.key, state]));
  const steps = flow.steps.map((step) => {
    const mapped = stateByKey.get(step.key);
    return {
      key: step.key,
      label: mapped?.label ?? step.key,
      state: mapped?.state ?? step.state,
      completedAt: step.completedAt?.toISOString() ?? null,
    };
  });

  return {
    flow: {
      id: flow.id,
      number: flow.number,
      title: flow.title,
      clientName: flow.clientName,
      status: flow.status,
      currentStepKey: flow.currentStepKey,
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
      severity: risk.severity,
      title: risk.title,
      description: risk.description,
    })),
    questions: flow.questions.map((question) => ({
      id: question.id,
      authorName: question.authorName,
      source: question.source,
      text: question.text,
      status: question.status,
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
      type: task.type,
      title: task.title,
      status: task.status,
      assigneeName: task.assigneeUser?.name ?? task.assigneeUser?.email ?? null,
      dueDate: task.dueDate?.toISOString() ?? null,
    })),
    insights: flow.aiInsights.map((insight) => ({
      id: insight.id,
      type: insight.type,
      title: insight.title,
      description: insight.description,
      severity: insight.severity ?? null,
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
}
