import type { ExecutiveDashboardPayload } from "../../features/crm-dashboard/executive-types";

/**
 * Текстовий зріз executive-дашборду для AI refresh (українською, мінімум PII).
 */
export function buildExecutiveDashboardAiContext(
  p: ExecutiveDashboardPayload,
): string {
  const lines: string[] = [
    "=== ENVER CRM — Executive dashboard ===",
    `Режим макета: ${p.layout}.`,
    `Фільтри: financeRange=${p.query.financeRange}, trendRange=${p.query.trendRange}, metric=${p.query.trendMetric}, view=${p.query.savedView}.`,
    "",
    "=== KPI ===",
    ...p.kpis.map(
      (k) =>
        `- ${k.title}: ${k.value} (${k.hint})`,
    ),
    "",
    "=== Наступні дії ===",
    ...p.nextActions.map((a) => `- ${a.title}: ${a.reason} → ${a.href}`),
    "",
    "=== Ризики (топ) ===",
    ...p.risks.slice(0, 8).map(
      (r) => `- ${r.name} [${r.riskType}] score ${r.score}: ${r.reason}`,
    ),
  ];

  if (p.finance) {
    lines.push(
      "",
      "=== Фінанси ===",
      `Оплати сьогодні: ${Math.round(p.finance.paymentsToday)}; прострочення: ${Math.round(p.finance.paymentsOverdue)}; витрати місяця: ${Math.round(p.finance.expensesMonth)}.`,
    );
  }
  if (p.production) {
    lines.push(
      "",
      "=== Виробництво ===",
      `Черга ${p.production.queued}, в роботі ${p.production.inProgress}, затримки ${p.production.delayed}.`,
    );
  }
  if (p.procurement) {
    lines.push(
      "",
      "=== Закупівлі ===",
      `PO: ${p.procurement.pendingOrders}, затримки постачальників: ${p.procurement.supplierDelays}.`,
    );
  }

  return lines.join("\n");
}
