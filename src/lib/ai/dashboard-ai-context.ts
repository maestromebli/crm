import type { SessionAccess } from "../authz/session-access";
import { hasUnrestrictedDataScope } from "../authz/roles";
import type { DashboardSnapshot } from "../../features/dashboard/queries";
import type { CrmDashboardAnalytics } from "../../features/crm-dashboard/analytics";

export type BuildServerDashboardAiContextInput = {
  access: SessionAccess;
  snapshot: DashboardSnapshot;
  analytics: CrmDashboardAnalytics;
};

/**
 * Текстовий зріз дашборду для AI (українською, без зайвих PII).
 * Дані вже відфільтровані RBAC у loadDashboardSnapshot / loadCrmDashboardAnalytics.
 */
export function buildServerDashboardAiContext(
  input: BuildServerDashboardAiContextInput,
): string {
  const { access, snapshot, analytics } = input;
  const scope = hasUnrestrictedDataScope(access.role)
    ? "повна видимість по компанії"
    : "обмежена видимість (свої/лінія продажів за політикою ролі)";

  const lines: string[] = [
    `Користувач: роль ${access.role}, область даних: ${scope}.`,
    `Період аналітики: ${analytics.periodLabel}.`,
    "",
    "=== Показники (операційний зріз) ===",
    `Нові ліди за 24 год: ${snapshot.kpiNewLeads24h} (попередні 24 год: ${snapshot.kpiNewLeadsPrev24h}).`,
    `Відкриті угоди: ${snapshot.kpiOpenDeals}; на етапі договору: ${snapshot.kpiDealsInContractStage}.`,
    `Прострочені задачі: ${snapshot.kpiOverdueTasks}.`,
    `Майбутні монтажі (лічильник): ${snapshot.installationUpcoming}; ризик виробництва: ${snapshot.productionRisk}.`,
    `Підпис Дія — прострочені очікування: ${snapshot.signatureStaleCount}.`,
    "",
    "=== CRM аналітика за період ===",
    `Активні ліди: ${analytics.activeLeads}; нові за період: ${analytics.newLeadsInPeriod}.`,
    `КП надіслано: ${analytics.proposalsSent}; погоджено: ${analytics.proposalsApproved}.`,
    `Угоди виграно за період: ${analytics.dealsWonInPeriod}; сума виручки (оцінка з угод): ${Math.round(analytics.revenueInPeriod)} UAH.`,
    `КП без руху >48 год: ${analytics.staleProposals48h}; ліди без контакту >24 год: ${analytics.leadsNoContact24h}.`,
    "",
    "=== Увага (короткий список) ===",
    ...snapshot.attention.slice(0, 12).map(
      (a) =>
        `- ${a.label} (${a.type}, ${a.severity}): ${a.detail}${a.href ? ` → ${a.href}` : ""}`,
    ),
    "",
    "=== Ризикові ліди (топ) ===",
    ...analytics.riskyLeads.slice(0, 8).map(
      (r) => `- ${r.title} (score ${r.score}): ${r.reason}`,
    ),
    "",
    "=== Рекомендовані дії ===",
    ...analytics.nextBestActions.map(
      (x) => `- ${x.title}: ${x.reason} (${x.href})`,
    ),
    "",
    "=== Тренд по днях (остання частина періоду) ===",
    ...analytics.trend.slice(-10).map(
      (t) =>
        `- ${t.label}: ліди ${t.leads}, виграні угоди ${t.dealsWon}, виручка ~${Math.round(t.revenue)} UAH`,
    ),
  ];

  return lines.join("\n");
}
