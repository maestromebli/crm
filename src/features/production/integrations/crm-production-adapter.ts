import type { ProductionOrderHubView } from "../types/production";
import type { ProductionOrderOpsState } from "../types/operations-core";

export function mapProductionHubToOpsState(view: ProductionOrderHubView): ProductionOrderOpsState {
  return {
    orderId: view.flow.id,
    dealId: view.flow.id,
    orderName: view.flow.title,
    clientName: view.flow.clientName,
    stage: view.flow.status === "DONE" ? "COMPLETED" : "PRODUCTION",
    productionStage: "PREPARATION",
    installationStatus: "NOT_PLANNED",
    paymentConfirmed: true,
    contractConfirmed: true,
    measurementCompleted: true,
    approvedCalculationExists: true,
    approvedFilesExist: view.filePackages.length > 0,
    commentsResolved: view.questions.filter((q) => q.status === "OPEN").length === 0,
    materialsReadiness: "PARTIAL",
    constructorAssigned: Boolean(view.flow.constructorName),
    drawingsApproved: view.filePackages.some((pkg) => pkg.approvalStatus === "APPROVED"),
    splitCompleted: view.flow.currentStepKey === "TASKS_DISTRIBUTED",
    blockers: view.blockers.map((blocker) => ({
      id: blocker.id,
      title: blocker.title,
      description: blocker.description,
      severity: blocker.severity,
    })),
    timeline: view.timeline.map((event) => ({
      id: event.id,
      at: event.createdAt,
      title: event.title,
      description: event.description ?? undefined,
      actor: event.actorName ?? undefined,
    })),
    productLines: [{ id: "summary", name: view.flow.title, quantity: 1 }],
    priority: view.flow.riskScore >= 70 ? "HIGH" : view.flow.riskScore >= 40 ? "MEDIUM" : "LOW",
  };
}
