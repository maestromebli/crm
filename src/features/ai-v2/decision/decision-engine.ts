import type { AiV2ContextSnapshot, AiV2Decision } from "../core/types";
import { evaluateAiV2RiskSignals } from "@/features/risk/evaluate-ai-v2-risk";
import { calcAiV2HealthScore } from "@/features/health/calc-ai-v2-health-score";

function clampRisk(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function runAiV2DecisionEngine(context: AiV2ContextSnapshot): AiV2Decision {
  const { flags } = context;
  const signals = evaluateAiV2RiskSignals(context);
  const riskScore = clampRisk(
    signals.reduce((sum, signal) => sum + signal.weight, 0),
  );
  const healthScore = calcAiV2HealthScore(signals);

  const blockers: string[] = [];
  if (flags.missingFiles > 0) blockers.push("Не вистачає обов'язкових файлів.");
  if (flags.missingDataCount > 0) {
    blockers.push("Не заповнені ключові поля даних по клієнту/угоді.");
  }
  if (flags.slaBreached) {
    blockers.push(`Порушено SLA першого контакту (+${flags.slaOverdueHours} год).`);
  }
  if (flags.pendingPayments > 0) blockers.push("Є неоплачені або прострочені платежі.");
  if (flags.openConstructorQuestions > 0) {
    blockers.push("Є відкриті технічні питання конструктора.");
  }
  if (flags.overdueTasks > 0) blockers.push("Є прострочені задачі, які блокують рух етапу.");

  const followUpUrgency =
    flags.silenceHours >= 48 || riskScore >= 75
      ? "high"
      : flags.silenceHours >= 24 || riskScore >= 45
        ? "medium"
        : "low";

  const readinessToNextStage =
    blockers.length === 0 ? "ready" : riskScore >= 70 ? "not_ready" : "attention";

  const nextBestAction =
    blockers[0] ??
    (followUpUrgency === "high"
      ? "Потрібен терміновий follow-up із клієнтом."
      : "Оновіть задачі та зафіксуйте наступний крок по угоді.");

  const summary =
    riskScore >= 70
      ? "Стан високого ризику: потрібні точкові дії для стабілізації етапу."
      : riskScore >= 40
        ? "Є кілька факторів ризику, які варто закрити до переходу на наступний етап."
        : "Стан контрольований, критичних блокерів наразі не виявлено.";

  return {
    summary,
    riskScore,
    healthScore,
    blockers,
    riskReasons: signals.map((s) => s.reason).slice(0, 5),
    nextBestAction,
    followUpUrgency,
    readinessToNextStage,
  };
}
