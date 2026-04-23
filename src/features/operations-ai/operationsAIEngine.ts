import type { OpsAiInsight, ProductionOrderOpsState } from "@/features/production/types/operations-core";

function pushInsight(
  list: OpsAiInsight[],
  title: string,
  description: string,
  severity: OpsAiInsight["severity"],
  suggestedAction?: string,
) {
  list.push({
    id: `${list.length + 1}`,
    title,
    description,
    severity,
    suggestedAction,
  });
}

export function operationsAIEngine(order: ProductionOrderOpsState): OpsAiInsight[] {
  const insights: OpsAiInsight[] = [];

  if (!order.approvedFilesExist) {
    pushInsight(insights, "Немає затверджених креслень", "Замовлення не може перейти в split без фінального пакету файлів.", "CRITICAL", "Відкрити робоче місце конструктора");
  }
  if (order.drawingsApproved && (order.materialsReadiness === "TO_BUY" || order.materialsReadiness === "PARTIAL")) {
    pushInsight(insights, "Ризик по матеріалах", "Матеріали ще не готові, а виробничі етапи можуть стартувати із затримкою.", "HIGH", "Контроль закупівлі");
  }
  if (order.productionStage === "PACKING" && order.installationStatus === "NOT_PLANNED") {
    pushInsight(insights, "Монтаж не запланований", "Пакування майже завершено, але дата монтажу ще не зафіксована.", "MEDIUM", "Запланувати монтаж");
  }
  if (!order.paymentConfirmed || !order.contractConfirmed) {
    pushInsight(insights, "Комерційний блокер", "Не підтверджено договір або обов'язковий платіж.", "HIGH", "Уточнити фінансову готовність");
  }
  if (order.blockers.length > 0) {
    pushInsight(insights, "Активні блокери", `Зафіксовано ${order.blockers.length} блокер(и), потрібна ескалація.`, "HIGH", "Відкрити блокери");
  }

  if (insights.length === 0) {
    pushInsight(insights, "Операційний стан стабільний", "Критичних ризиків не виявлено. Продовжуйте рух за поточним наступний крок.", "LOW");
  }
  return insights;
}
