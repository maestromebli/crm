import type { AiV2RiskSignal } from "@/features/risk/evaluate-ai-v2-risk";

export function calcAiV2HealthScore(signals: AiV2RiskSignal[]): number {
  const totalRisk = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const score = 100 - totalRisk;
  return Math.max(0, Math.min(100, Math.round(score)));
}
