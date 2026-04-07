import { prisma } from "@/lib/prisma";
import { recomputeFlowMetrics } from "./production-flow.service";
import { refreshFlowAiInsights } from "./production-ai.service";

async function latestPackageForFlow(flowId: string) {
  return prisma.productionFilePackage.findFirst({
    where: { flowId },
    orderBy: { uploadedAt: "desc" },
    select: { id: true },
  });
}

export async function approveLatestPackage(flowId: string, actorName: string) {
  const pkg = await latestPackageForFlow(flowId);
  if (!pkg) throw new Error("Немає пакета файлів для апруву.");

  await prisma.productionApproval.create({
    data: {
      flowId,
      packageId: pkg.id,
      status: "APPROVED",
      actorName,
      decidedAt: new Date(),
    },
  });
  await prisma.productionFilePackage.update({
    where: { id: pkg.id },
    data: { approvalStatus: "APPROVED" },
  });
  await prisma.productionFlow.update({
    where: { id: flowId },
    data: {
      approvedAt: new Date(),
      currentStepKey: "TASKS_DISTRIBUTED",
      status: "ACTIVE",
    },
  });
  await prisma.productionFlowStep.update({
    where: { flowId_key: { flowId, key: "APPROVED_BY_CHIEF" } },
    data: { state: "DONE", completedAt: new Date() },
  });
  await prisma.productionFlowStep.update({
    where: { flowId_key: { flowId, key: "TASKS_DISTRIBUTED" } },
    data: { state: "AVAILABLE" },
  });
  await prisma.productionEvent.create({
    data: {
      flowId,
      type: "APPROVAL_APPROVED",
      title: "Пакет затверджено начальником виробництва",
      actorName,
    },
  });
  await recomputeFlowMetrics(flowId);
  await refreshFlowAiInsights(flowId);
}

export async function rejectLatestPackage(flowId: string, actorName: string, reason: string) {
  const pkg = await latestPackageForFlow(flowId);
  if (!pkg) throw new Error("Немає пакета файлів для відхилення.");

  await prisma.productionApproval.create({
    data: {
      flowId,
      packageId: pkg.id,
      status: "REJECTED",
      actorName,
      decidedAt: new Date(),
      reason,
    },
  });
  await prisma.productionFilePackage.update({
    where: { id: pkg.id },
    data: { approvalStatus: "REJECTED" },
  });
  await prisma.productionFlow.update({
    where: { id: flowId },
    data: {
      currentStepKey: "CONSTRUCTOR_IN_PROGRESS",
      status: "BLOCKED",
    },
  });
  await prisma.productionFlowStep.update({
    where: { flowId_key: { flowId, key: "APPROVED_BY_CHIEF" } },
    data: { state: "BLOCKED", completedAt: null },
  });
  await prisma.productionFlowStep.update({
    where: { flowId_key: { flowId, key: "CONSTRUCTOR_IN_PROGRESS" } },
    data: { state: "IN_PROGRESS" },
  });
  await prisma.productionEvent.create({
    data: {
      flowId,
      type: "APPROVAL_REJECTED",
      title: "Пакет повернено на доопрацювання",
      actorName,
      description: reason,
    },
  });
  await recomputeFlowMetrics(flowId);
  await refreshFlowAiInsights(flowId);
}
