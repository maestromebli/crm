import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { computeReadinessPercent, computeRiskScore } from "./production-metrics.service";
import { PRODUCTION_STEP_SEQUENCE } from "./production-step.service";
import { refreshFlowAiInsights } from "./production-ai.service";

type Actor = { actorName: string };

function buildConstructorWorkspaceUrl(token?: string | null): string {
  if (token && token.trim()) return `/constructor/${token.trim()}`;
  return `/constructor/${randomBytes(16).toString("hex")}`;
}

function buildTelegramThreadUrl(flowNumber: string): string {
  const slug = flowNumber.toLowerCase();
  return `https://t.me/+enver-${slug}-thread`;
}

async function createEvent(input: {
  flowId: string;
  type: string;
  title: string;
  description?: string | null;
  metadataJson?: Record<string, unknown>;
  actorName?: string | null;
}) {
  await prisma.productionEvent.create({
    data: {
      flowId: input.flowId,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      metadataJson: (input.metadataJson as Prisma.InputJsonValue | undefined) ?? undefined,
      actorName: input.actorName ?? null,
    },
  });
}

async function syncCounters(flowId: string) {
  const [blockersCount, openQuestionsCount, procurementTasksCount, workshopTasksCount] = await Promise.all([
    prisma.productionRisk.count({ where: { flowId, resolvedAt: null, severity: { in: ["HIGH", "CRITICAL"] } } }),
    prisma.productionQuestion.count({ where: { flowId, status: "OPEN" } }),
    prisma.productionTask.count({ where: { flowId, type: "PROCUREMENT", status: { not: "CANCELLED" } } }),
    prisma.productionTask.count({ where: { flowId, type: "WORKSHOP", status: { not: "CANCELLED" } } }),
  ]);

  return { blockersCount, openQuestionsCount, procurementTasksCount, workshopTasksCount };
}

export async function recomputeFlowMetrics(flowId: string) {
  const flow = await prisma.productionFlow.findUnique({
    where: { id: flowId },
    select: { id: true, currentStepKey: true, dueDate: true },
  });
  if (!flow) return null;

  const counters = await syncCounters(flowId);
  const now = Date.now();
  const isOverdue = Boolean(flow.dueDate && flow.dueDate.getTime() < now);
  const rejectedApprovalCount = await prisma.productionApproval.count({
    where: { flowId, status: "REJECTED" },
  });
  const stationOverloadCount = await prisma.productionStationLoad.count({
    where: { flowId, loadPercent: { gte: 85 } },
  });
  const latestPackage = await prisma.productionFilePackage.findFirst({
    where: { flowId },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, uploadedAt: true },
  });
  const missingFilePackageAfterConstructorDueDate = Boolean(isOverdue && !latestPackage);

  const readinessPercent = computeReadinessPercent({
    currentStepKey: flow.currentStepKey,
    blockersCount: counters.blockersCount,
    unresolvedQuestionsCount: counters.openQuestionsCount,
    isOverdue,
  });

  const riskScore = computeRiskScore({
    blockersCount: counters.blockersCount,
    unresolvedQuestionsCount: counters.openQuestionsCount,
    stationOverloadCount,
    rejectedApprovalCount,
    isOverdue,
    missingFilePackageAfterConstructorDueDate,
  });

  return prisma.productionFlow.update({
    where: { id: flowId },
    data: {
      readinessPercent,
      riskScore,
      blockersCount: counters.blockersCount,
      openQuestionsCount: counters.openQuestionsCount,
      procurementTasksCount: counters.procurementTasksCount,
      workshopTasksCount: counters.workshopTasksCount,
    },
  });
}

export async function createProductionFlowFromDealHandoff(input: {
  dealId: string;
  actorName: string;
  defaultChiefUserId?: string | null;
}) {
  const deal = await prisma.deal.findUnique({
    where: { id: input.dealId },
    select: {
      id: true,
      title: true,
      expectedCloseDate: true,
      owner: { select: { name: true, email: true } },
      client: { select: { name: true } },
    },
  });
  if (!deal) throw new Error("Угоду не знайдено");

  const existing = await prisma.productionFlow.findUnique({ where: { dealId: input.dealId } });
  if (existing) return existing;

  const count = await prisma.productionFlow.count();
  const number = `PR-${String(count + 1).padStart(3, "0")}`;

  const flow = await prisma.productionFlow.create({
    data: {
      dealId: input.dealId,
      number,
      title: deal.title,
      clientName: deal.client.name,
      productSummary: deal.title,
      status: "NEW",
      currentStepKey: "ACCEPTED_BY_CHIEF",
      dueDate: deal.expectedCloseDate,
      chiefUserId: input.defaultChiefUserId ?? null,
      steps: {
        create: PRODUCTION_STEP_SEQUENCE.map((key, index) => ({
          key,
          sortOrder: index,
          state: index === 0 ? "AVAILABLE" : "LOCKED",
        })),
      },
    },
  });

  await createEvent({
    flowId: flow.id,
    type: "FLOW_CREATED",
    title: "Потік створено з передачі угоди",
    description: `Потік ${number} готовий до прийняття в роботу.`,
    actorName: input.actorName,
  });
  await recomputeFlowMetrics(flow.id);
  return flow;
}

async function moveToStep(flowId: string, step: (typeof PRODUCTION_STEP_SEQUENCE)[number]) {
  const index = PRODUCTION_STEP_SEQUENCE.indexOf(step);
  await prisma.productionFlowStep.updateMany({
    where: { flowId },
    data: { state: "LOCKED", completedAt: null },
  });
  for (let i = 0; i < PRODUCTION_STEP_SEQUENCE.length; i += 1) {
    const key = PRODUCTION_STEP_SEQUENCE[i];
    if (i < index) {
      await prisma.productionFlowStep.update({
        where: { flowId_key: { flowId, key } },
        data: { state: "DONE", completedAt: new Date() },
      });
    } else if (i === index) {
      await prisma.productionFlowStep.update({
        where: { flowId_key: { flowId, key } },
        data: { state: "IN_PROGRESS" },
      });
    } else if (i === index + 1) {
      await prisma.productionFlowStep.update({
        where: { flowId_key: { flowId, key } },
        data: { state: "AVAILABLE" },
      });
    }
  }
}

export async function acceptFlowByChief(flowId: string, actor: Actor & { chiefUserId?: string | null }) {
  const flow = await prisma.productionFlow.findUnique({ where: { id: flowId } });
  if (!flow) throw new Error("Потік не знайдено");

  await prisma.productionFlow.update({
    where: { id: flowId },
    data: {
      status: "ACTIVE",
      currentStepKey: "CONSTRUCTOR_ASSIGNED",
      acceptedAt: new Date(),
      chiefUserId: actor.chiefUserId ?? flow.chiefUserId,
    },
  });
  await moveToStep(flowId, "CONSTRUCTOR_ASSIGNED");
  await createEvent({
    flowId,
    type: "FLOW_ACCEPTED",
    title: "Потік прийнято в роботу",
    actorName: actor.actorName,
  });
  await recomputeFlowMetrics(flowId);
}

export async function assignConstructor(
  flowId: string,
  input: Actor & {
    constructorMode: "INTERNAL" | "OUTSOURCE";
    constructorName: string;
    constructorCompany?: string | null;
    constructorWorkspaceUrl?: string | null;
    dueDate: string;
  },
) {
  const flow = await prisma.productionFlow.findUnique({
    where: { id: flowId },
    select: { number: true, constructorWorkspaceUrl: true, telegramThreadUrl: true },
  });
  if (!flow) throw new Error("Потік не знайдено");

  const workspaceUrl =
    input.constructorWorkspaceUrl ??
    flow.constructorWorkspaceUrl ??
    buildConstructorWorkspaceUrl();
  const telegramThreadUrl = flow.telegramThreadUrl ?? buildTelegramThreadUrl(flow.number);

  await prisma.productionFlow.update({
    where: { id: flowId },
    data: {
      constructorMode: input.constructorMode,
      constructorName: input.constructorName,
      constructorCompany: input.constructorCompany ?? null,
      constructorWorkspaceUrl: workspaceUrl,
      telegramThreadUrl,
      dueDate: new Date(input.dueDate),
      currentStepKey: "CONSTRUCTOR_IN_PROGRESS",
      status: "ACTIVE",
    },
  });
  await moveToStep(flowId, "CONSTRUCTOR_IN_PROGRESS");
  await createEvent({
    flowId,
    type: "CONSTRUCTOR_ASSIGNED",
    title: "Конструктора призначено",
    description: `${input.constructorName} (${input.constructorMode})`,
    actorName: input.actorName,
  });
  await createEvent({
    flowId,
    type: "TELEGRAM_THREAD_CREATED",
    title: "Створено Telegram-комунікацію",
    description: telegramThreadUrl,
    actorName: "SYSTEM",
  });
  await recomputeFlowMetrics(flowId);
  await refreshFlowAiInsights(flowId);
}

export async function addFlowQuestion(
  flowId: string,
  input: Actor & {
    text: string;
    source?: string;
    isCritical?: boolean;
  },
) {
  const question = await prisma.productionQuestion.create({
    data: {
      flowId,
      source: input.source ?? "INTERNAL",
      authorName: input.actorName,
      text: input.text,
      isCritical: input.isCritical ?? false,
    },
  });
  await createEvent({
    flowId,
    type: "QUESTION_CREATED",
    title: "Додано питання",
    description: input.text,
    actorName: input.actorName,
  });
  await recomputeFlowMetrics(flowId);
  await refreshFlowAiInsights(flowId);
  return question;
}

export async function registerFilePackage(
  flowId: string,
  input: Actor & {
    packageName: string;
    versionLabel: string;
    packageTypeTags: string[];
    note?: string | null;
    files: Array<{ fileName: string; fileType?: string | null; fileUrl?: string | null }>;
  },
) {
  const pkg = await prisma.productionFilePackage.create({
    data: {
      flowId,
      packageName: input.packageName,
      versionLabel: input.versionLabel,
      packageTypeTags: input.packageTypeTags,
      note: input.note ?? null,
      uploadedByName: input.actorName,
      files: {
        create: input.files.map((file) => ({
          fileName: file.fileName,
          fileType: file.fileType ?? null,
          fileUrl: file.fileUrl ?? null,
        })),
      },
    },
    include: { files: true },
  });

  await prisma.productionFlow.update({
    where: { id: flowId },
    data: {
      currentStepKey: "FILES_VALIDATED",
      status: "ACTIVE",
    },
  });
  await moveToStep(flowId, "FILES_VALIDATED");
  await createEvent({
    flowId,
    type: "FILES_PACKAGE_REGISTERED",
    title: "Зареєстровано пакет файлів",
    description: `${pkg.packageName} · ${pkg.versionLabel}`,
    actorName: input.actorName,
  });
  await recomputeFlowMetrics(flowId);
  await refreshFlowAiInsights(flowId);
  return pkg;
}
