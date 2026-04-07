import { prisma } from "@/lib/prisma";

export async function refreshFlowAiInsights(flowId: string) {
  const flow = await prisma.productionFlow.findUnique({
    where: { id: flowId },
    include: {
      questions: { where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 5 },
      risks: { where: { resolvedAt: null }, orderBy: [{ severity: "desc" }, { createdAt: "desc" }], take: 5 },
      stationLoads: { where: { loadPercent: { gte: 80 } }, orderBy: { loadPercent: "desc" }, take: 3 },
      filePackages: { orderBy: { uploadedAt: "desc" }, take: 1 },
    },
  });
  if (!flow) return;

  await prisma.productionAIInsight.deleteMany({ where: { flowId } });

  const insights: Array<{
    type: "SUMMARY" | "WARNING" | "NEXT_ACTION" | "RISK";
    title: string;
    description: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
    recommendedAction?: string | null;
  }> = [];

  insights.push({
    type: "SUMMARY",
    title: "Стан потоку",
    description: `Поточний крок: ${flow.currentStepKey}. Готовність: ${flow.readinessPercent}%. Ризик: ${flow.riskScore}/100.`,
    severity: null,
  });

  if (flow.questions.length > 0) {
    insights.push({
      type: "WARNING",
      title: "Відкриті питання",
      description: `Є ${flow.questions.length} відкритих питань — апрув ризикований.`,
      severity: flow.questions.length >= 3 ? "HIGH" : "MEDIUM",
      recommendedAction: "Закрийте критичні питання перед апрувом.",
    });
  }

  if (flow.filePackages.length === 0 && flow.currentStepKey !== "ACCEPTED_BY_CHIEF") {
    insights.push({
      type: "RISK",
      title: "Немає пакета файлів",
      description: "Пакет файлів не завантажено після старту конструкторського етапу.",
      severity: "HIGH",
      recommendedAction: "Зареєструйте пакет файлів (DXF/PDF/Spec).",
    });
  }

  if (flow.stationLoads.length > 0) {
    const overloaded = flow.stationLoads[0];
    insights.push({
      type: "RISK",
      title: "Перевантаження дільниці",
      description: `${overloaded.stationLabel} перевантажено на ${overloaded.loadPercent}%.`,
      severity: overloaded.loadPercent >= 90 ? "CRITICAL" : "HIGH",
      recommendedAction: "Перерозподіліть завдання або змістіть дедлайн.",
    });
  }

  const topRisk = flow.risks[0];
  if (topRisk) {
    insights.push({
      type: "NEXT_ACTION",
      title: "Наступна дія",
      description: `Усуньте блокер: ${topRisk.title}.`,
      severity: topRisk.severity,
      recommendedAction: "Вирішити блокер і повторити перевірку.",
    });
  }

  if (insights.length === 1) {
    insights.push({
      type: "NEXT_ACTION",
      title: "Стабільний стан",
      description: "Критичних блокерів не виявлено. Можна рухати потік далі.",
      severity: "LOW",
      recommendedAction: "Підтвердьте поточний етап та продовжіть процес.",
    });
  }

  await prisma.productionAIInsight.createMany({
    data: insights.slice(0, 10).map((insight) => ({
      flowId,
      type: insight.type,
      title: insight.title,
      description: insight.description,
      severity: insight.severity,
      recommendedAction: insight.recommendedAction ?? null,
    })),
  });
}
