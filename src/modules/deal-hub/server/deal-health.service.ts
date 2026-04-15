import { differenceInCalendarDays } from "date-fns";
import type { DealHealthEvaluation, DealHealthSignal } from "../domain/deal-health.types";
import type { DealHubAggregate } from "./deal-hub.repository";

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function evaluateDealHealth(aggregate: DealHubAggregate): DealHealthEvaluation {
  const signals: DealHealthSignal[] = [];
  const reasons: string[] = [];
  const suggestedActions: string[] = [];

  const now = new Date();
  const deal = aggregate.deal;
  if (!deal) {
    return {
      status: "CRITICAL",
      score: 0,
      reasons: ["Deal not found"],
      signals: ["NEXT_OWNER_UNCLEAR"],
      suggestedActions: ["Reload deal workspace"],
    };
  }

  const finance = deal.financeSnapshots[0] ?? null;
  const margin = toNumber(finance?.marginPct);
  if (margin != null && margin < 18) {
    signals.push("LOW_MARGIN");
    reasons.push(`Low expected margin (${margin.toFixed(1)}%)`);
    suggestedActions.push("Review pricing version and margin strategy");
  }

  const overduePayment = deal.paymentMilestones.some(
    (m) => !m.confirmedAt && m.dueAt && m.dueAt.getTime() < now.getTime(),
  );
  if (overduePayment) {
    signals.push("OVERDUE_PAYMENT");
    reasons.push("Overdue payment milestone detected");
    suggestedActions.push("Collect or replan overdue payment milestone");
  }

  const meta = (deal.workspaceMeta ?? {}) as Record<string, unknown>;
  const measurementComplete = Boolean(meta.measurementComplete);
  if (!measurementComplete) {
    signals.push("MISSING_MEASUREMENT");
    reasons.push("Measurement is not marked complete");
    suggestedActions.push("Schedule and confirm measurement");
  }

  const hasDrawings = aggregate.latestAttachments.some(
    (f) => String(f.category).toUpperCase().includes("DRAW"),
  );
  if (!hasDrawings) {
    signals.push("MISSING_TECHNICAL_FILES");
    reasons.push("No technical drawing files found");
    suggestedActions.push("Upload technical drawings before production release");
  }

  if (!deal.productionFlow && String(deal.stage.slug).toLowerCase().includes("production")) {
    signals.push("PRODUCTION_BLOCKER");
    reasons.push("Deal is in production stage without production flow");
    suggestedActions.push("Create or attach production flow");
  }

  const hasOverdueTask = aggregate.openTasks.some(
    (task) => task.dueAt && differenceInCalendarDays(task.dueAt, now) < 0,
  );
  if (hasOverdueTask) {
    signals.push("MISSED_MILESTONE");
    reasons.push("There are overdue execution tasks");
    suggestedActions.push("Close or replan overdue tasks");
  }

  if (!deal.installationDate && ["DELIVERY_READY", "INSTALLATION"].includes(String(deal.stage.slug).toUpperCase())) {
    signals.push("INSTALLATION_UNSCHEDULED");
    reasons.push("Installation stage has no planned date");
    suggestedActions.push("Schedule installation date and team");
  }

  const lastActivityAt = aggregate.timelineActivity[0]?.createdAt ?? null;
  if (!lastActivityAt || differenceInCalendarDays(now, lastActivityAt) > 7) {
    signals.push("STALE_ACTIVITY");
    reasons.push("No recent activity in the deal");
    suggestedActions.push("Update timeline with current execution status");
  }

  const score = Math.max(0, 100 - signals.length * 15);
  const status =
    score >= 80
      ? "GOOD"
      : score >= 60
        ? "WARNING"
        : score >= 40
          ? "RISK"
          : "CRITICAL";

  return {
    status,
    score,
    reasons,
    signals,
    suggestedActions,
  };
}
