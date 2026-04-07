import type { AiV2ContextSnapshot } from "@/features/ai-v2/core/types";

export type AiV2RiskSignal = {
  id: string;
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
  weight: number;
};

export function evaluateAiV2RiskSignals(
  context: AiV2ContextSnapshot,
): AiV2RiskSignal[] {
  const { flags } = context;
  const signals: AiV2RiskSignal[] = [];

  if (flags.silenceHours >= 48) {
    signals.push({
      id: "no_contact_48h",
      reason: "Немає активного контакту більше 48 годин.",
      severity: "high",
      weight: 22,
    });
  } else if (flags.silenceHours >= 24) {
    signals.push({
      id: "no_contact_24h",
      reason: "Контакт із клієнтом відсутній понад 24 години.",
      severity: "medium",
      weight: 10,
    });
  }

  if (flags.missingFiles > 0) {
    signals.push({
      id: "missing_required_files",
      reason: "Відсутні обов'язкові файли для поточного етапу.",
      severity: "high",
      weight: 25,
    });
  }

  if (flags.missingDataCount > 0) {
    signals.push({
      id: "missing_key_data",
      reason: "Відсутні ключові поля даних (бюджет/дедлайн/контакт тощо).",
      severity: flags.missingDataCount >= 3 ? "high" : "medium",
      weight: Math.min(24, flags.missingDataCount * 7),
    });
  }

  if (flags.slaBreached) {
    signals.push({
      id: "sla_breached",
      reason: `Порушено SLA першого контакту на ${flags.slaOverdueHours} год.`,
      severity: "high",
      weight: 20,
    });
  }

  if (flags.pendingPayments > 0) {
    signals.push({
      id: "pending_or_overdue_payments",
      reason: "Є неоплачені або прострочені платежі.",
      severity: "high",
      weight: 18,
    });
  }

  if (flags.overdueTasks > 0) {
    signals.push({
      id: "overdue_tasks",
      reason: "Є прострочені задачі, що гальмують рух етапу.",
      severity: flags.overdueTasks >= 3 ? "high" : "medium",
      weight: Math.min(24, flags.overdueTasks * 8),
    });
  }

  if (flags.openConstructorQuestions > 0) {
    signals.push({
      id: "open_constructor_questions",
      reason: "Є відкриті технічні питання конструктора.",
      severity: flags.openConstructorQuestions >= 3 ? "high" : "medium",
      weight: Math.min(20, flags.openConstructorQuestions * 6),
    });
  }

  return signals.sort((a, b) => b.weight - a.weight);
}
