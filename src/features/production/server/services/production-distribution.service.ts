import { prisma } from "@/lib/prisma";
import { buildDefaultMaterialsChecklist } from "../../workshop-materials";
import { recomputeFlowMetrics } from "./production-flow.service";
import { refreshFlowAiInsights } from "./production-ai.service";

const DEFAULT_PROCUREMENT_TASKS = [
  "Перевірити специфікацію матеріалів",
  "Створити запити постачальникам",
  "Підтвердити фурнітуру",
  "Зарезервувати складські позиції",
];

const DEFAULT_WORKSHOP_TASKS = [
  "Поставити у чергу розкрою",
  "Поставити у чергу кромкування",
  "Поставити у чергу свердління",
  "Підготувати складання",
];

export async function distributeFlowTasks(flowId: string, actorName: string) {
  const flow = await prisma.productionFlow.findUnique({ where: { id: flowId } });
  if (!flow) throw new Error("Потік не знайдено");

  const existing = await prisma.productionTask.count({
    where: { flowId, type: { in: ["PROCUREMENT", "WORKSHOP"] } },
  });
  if (existing === 0) {
    const now = new Date();
    await prisma.productionTask.createMany({
      data: [
        ...DEFAULT_PROCUREMENT_TASKS.map((title, index) => ({
          flowId,
          type: "PROCUREMENT" as const,
          title,
          status: "TODO" as const,
          dueDate: new Date(now.getTime() + (index + 1) * 24 * 60 * 60 * 1000),
          metadataJson: {
            supplier: null,
            expectedDate: new Date(now.getTime() + (index + 2) * 24 * 60 * 60 * 1000).toISOString(),
          },
        })),
        ...DEFAULT_WORKSHOP_TASKS.map((title, index) => {
          const workshopStage =
            index === 0
              ? "CUTTING"
              : index === 1
                ? "EDGING"
                : index === 2
                  ? "DRILLING"
                  : "ASSEMBLY";
          return {
            flowId,
            type: "WORKSHOP" as const,
            title,
            status: "TODO" as const,
            metadataJson: {
              workshopStage,
              materialsChecklist: buildDefaultMaterialsChecklist(workshopStage),
            },
          };
        }),
      ],
    });
  }

  await prisma.productionFlow.update({
    where: { id: flowId },
    data: {
      currentStepKey: "TASKS_DISTRIBUTED",
      status: "READY_FOR_PROCUREMENT_AND_WORKSHOP",
      distributedAt: new Date(),
    },
  });
  await prisma.productionFlowStep.update({
    where: { flowId_key: { flowId, key: "TASKS_DISTRIBUTED" } },
    data: { state: "DONE", completedAt: new Date() },
  });
  await prisma.productionEvent.create({
    data: {
      flowId,
      type: "TASKS_DISTRIBUTED",
      title: "Запущено розподіл задач",
      description: "Створено задачі для закупівлі та цеху.",
      actorName,
    },
  });
  await recomputeFlowMetrics(flowId);
  await refreshFlowAiInsights(flowId);
}

export async function createInstallationTasksFromWorkshop(flowId: string, actorName: string) {
  const workshopPending = await prisma.productionTask.count({
    where: {
      flowId,
      type: "WORKSHOP",
      status: { notIn: ["DONE", "CANCELLED"] },
    },
  });
  if (workshopPending > 0) {
    throw new Error("Не всі задачі цеху завершені. Монтаж поки не можна створити.");
  }

  const existingInstallation = await prisma.productionTask.count({
    where: { flowId, type: "INSTALLATION", status: { not: "CANCELLED" } },
  });
  if (existingInstallation === 0) {
    await prisma.productionTask.create({
      data: {
        flowId,
        type: "INSTALLATION",
        title: "Підготовка та виконання монтажу",
        status: "TODO",
        metadataJson: {
          address: null,
          team: "Монтажна бригада",
        },
      },
    });
  }

  await prisma.productionFlow.update({
    where: { id: flowId },
    data: {
      status: "READY_FOR_INSTALLATION",
    },
  });
  await prisma.productionEvent.create({
    data: {
      flowId,
      type: "INSTALLATION_TASKS_CREATED",
      title: "Створено задачі монтажу",
      actorName,
    },
  });
  await refreshFlowAiInsights(flowId);
}
