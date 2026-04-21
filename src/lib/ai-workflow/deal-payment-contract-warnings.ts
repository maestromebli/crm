import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { deriveDealWarnings } from "../../features/deal-workspace/deal-workspace-warnings";
import type { DealAiWarningItem } from "./types";

/**
 * Структуровані сигнали для AI-панелі замовлення (§8.2–8.3) поверх `deriveDealWarnings`.
 */
export function deriveDealPaymentContractAiWarnings(
  data: DealWorkspacePayload,
): DealAiWarningItem[] {
  const base = deriveDealWarnings(data).map((w) => ({
    title: w.key.replace(/_/g, " "),
    content: w.message,
    severity: w.level as DealAiWarningItem["severity"],
  }));

  const extra: DealAiWarningItem[] = [];

  if (
    data.deal.status === "OPEN" &&
    !data.contract &&
    data.operationalStats.estimatesCount > 0
  ) {
    extra.push({
      title: "Договір",
      content:
        "Є прорахунок, але договір не створено — ризик по оплаті та обсягу робіт.",
      severity: "warning",
    });
  }

  const c = data.contract?.status;
  if (
    c === "SENT_FOR_SIGNATURE" ||
    c === "VIEWED_BY_CLIENT" ||
    c === "CLIENT_SIGNED"
  ) {
    extra.push({
      title: "Підпис",
      content: "Договір у процесі підпису — контролюйте дедлайн клієнта.",
      severity: "info",
    });
  }

  const pay = data.meta.payment?.milestones ?? [];
  if (data.deal.status === "OPEN" && pay.length === 0) {
    extra.push({
      title: "Графік оплат",
      content: "Немає віх оплати — складно відстежувати передоплату та етапи.",
      severity: "warning",
    });
  }

  const seen = new Set<string>();
  const merged = [...base, ...extra].filter((x) => {
    const k = `${x.title}:${x.content}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return merged;
}
