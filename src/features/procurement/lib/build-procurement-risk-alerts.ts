import { formatMoneyUa } from "../../finance/lib/format-money";

type SaasSlice = {
  systemicRiskScore: number;
  overdueOpenRequestCount: number;
  openRequestCount: number;
  commitmentCoveragePct: number;
};

type KpiSlice = {
  overrun: number;
  openCommitmentGap: number;
};

export function buildProcurementRiskAlerts(
  saas: SaasSlice,
  kpi: KpiSlice,
): Array<{ level: "P0" | "P1" | "P2"; text: string }> {
  const out: Array<{ level: "P0" | "P1" | "P2"; text: string }> = [];

  if (saas.systemicRiskScore >= 70) {
    out.push({
      level: "P0",
      text: `Системний ризик закупівель ${saas.systemicRiskScore}/100 — потрібен контроль портфеля постачань.`,
    });
  } else if (saas.systemicRiskScore >= 50) {
    out.push({
      level: "P1",
      text: `Системний ризик ${saas.systemicRiskScore}/100 вище комфортного рівня.`,
    });
  }

  if (saas.overdueOpenRequestCount > 0) {
    out.push({
      level: "P1",
      text: `Є ${saas.overdueOpenRequestCount} прострочених відкритих заявок — перевірте дати «потрібно до».`,
    });
  }

  if (kpi.openCommitmentGap > 0) {
    out.push({
      level: "P1",
      text: `Розрив комітменту PO до факту поставки: ${formatMoneyUa(kpi.openCommitmentGap)} грн.`,
    });
  }

  if (kpi.overrun > 0) {
    out.push({
      level: "P2",
      text: `Перевищення плану по позиціях: ${formatMoneyUa(kpi.overrun)} грн.`,
    });
  }

  if (saas.commitmentCoveragePct < 85 && saas.commitmentCoveragePct > 0) {
    out.push({
      level: "P2",
      text: `Покриття комітменту ${saas.commitmentCoveragePct}% — частина зобовʼязань ще не закрита поставками.`,
    });
  }

  if (out.length === 0) {
    out.push({
      level: "P2",
      text: `Відкритих критичних сигналів немає (${saas.openRequestCount} заявок у роботі).`,
    });
  }

  return out.slice(0, 6);
}
