import { differenceInCalendarDays } from "date-fns";
import type { DealHubNextAction, DealHubRole } from "../domain/deal.types";
import type { DealHubAggregate } from "./deal-hub.repository";

type NextActionContext = {
  role: DealHubRole;
};

function withRole(actions: DealHubNextAction[], role: DealHubRole): DealHubNextAction[] {
  if (role === "OWNER") return actions;
  return actions.filter((action) => action.ownerRole === role || action.ownerRole === "MANAGER");
}

export function buildDealNextActions(
  aggregate: DealHubAggregate,
  ctx: NextActionContext,
): DealHubNextAction[] {
  const deal = aggregate.deal;
  if (!deal) return [];

  const actions: DealHubNextAction[] = [];
  const now = new Date();
  const stageSlug = String(deal.stage.slug).toLowerCase();
  const latestEstimate = deal.estimates[0];
  const meta = (deal.workspaceMeta ?? {}) as Record<string, unknown>;
  const hasApprovedPricing = deal.estimates.some((e) => e.status === "APPROVED");
  const hasContract = Boolean(deal.contract?.id);
  const hasDepositConfirmed = deal.paymentMilestones.some((m) => Boolean(m.confirmedAt));
  const hasMeasurement = Boolean(meta.measurementComplete);
  const hasProductionFlow = Boolean(deal.productionFlow?.id);

  if (!hasApprovedPricing) {
    actions.push({
      id: "approve-pricing",
      title: "Approve pricing/KP version",
      ownerRole: "SALES_MANAGER",
      status: "required",
      description: latestEstimate
        ? `Latest estimate v${latestEstimate.version} is not approved`
        : "No estimate version attached to deal",
      command: "approve-kp",
    });
  }

  if (hasApprovedPricing && !hasContract) {
    actions.push({
      id: "generate-contract",
      title: "Generate contract from approved pricing",
      ownerRole: "SALES_MANAGER",
      status: "required",
      command: "generate-contract",
    });
  }

  if (hasContract && !hasDepositConfirmed) {
    actions.push({
      id: "collect-deposit",
      title: "Collect deposit",
      ownerRole: "FINANCE",
      status: "required",
      command: "mark-deposit-received",
    });
  }

  if (hasDepositConfirmed && !hasMeasurement) {
    actions.push({
      id: "schedule-measurement",
      title: "Schedule measurement and confirm dimensions",
      ownerRole: "MANAGER",
      status: "required",
      command: "schedule-measurement",
    });
  }

  if (hasMeasurement && !hasProductionFlow) {
    actions.push({
      id: "release-production",
      title: "Release deal to production",
      ownerRole: "PRODUCTION_MANAGER",
      status: "required",
      command: "release-production",
    });
  }

  if (stageSlug.includes("installation") && !deal.installationDate) {
    actions.push({
      id: "schedule-installation",
      title: "Schedule installation date",
      ownerRole: "INSTALLATION_COORDINATOR",
      status: "required",
      command: "schedule-installation",
    });
  }

  for (const task of aggregate.openTasks) {
    const overdue = task.dueAt && differenceInCalendarDays(task.dueAt, now) < 0;
    if (!overdue) continue;
    actions.push({
      id: `task-${task.id}`,
      title: task.title,
      ownerRole: "MANAGER",
      status: "overdue",
      dueAt: task.dueAt?.toISOString(),
      description: "Execution task is overdue",
      command: "open-tasks",
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "monitor-стан",
      title: "Monitor deal стан and keep activity updated",
      ownerRole: "MANAGER",
      status: "suggested",
      command: "ask-ai-summary",
    });
  }

  return withRole(actions, ctx.role).slice(0, 8);
}
