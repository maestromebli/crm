import type {
  InstallationPreTaskDraft,
  ProductionOrderOpsState,
  ProductionSplitResult,
  ProductionTaskDraft,
  PurchaseTaskDraft,
  WarehouseReservationDraft,
} from "../types/operations-core";

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function productionSplitEngine(order: ProductionOrderOpsState): ProductionSplitResult {
  const purchaseRequests: PurchaseTaskDraft[] = [];
  const warehouseReservations: WarehouseReservationDraft[] = [];
  const productionTasks: ProductionTaskDraft[] = [];

  for (const line of order.productLines) {
    const materialName = line.material ?? `${line.name} / матеріал не уточнено`;

    if (order.materialsReadiness === "IN_STOCK" || order.materialsReadiness === "RESERVED") {
      warehouseReservations.push({
        materialName,
        qty: line.quantity,
        status: order.materialsReadiness === "IN_STOCK" ? "IN_STOCK" : "RESERVED",
      });
    } else {
      purchaseRequests.push({
        materialName,
        qty: line.quantity,
        urgency: order.priority === "HIGH" ? "HIGH" : "MEDIUM",
      });
      warehouseReservations.push({
        materialName,
        qty: line.quantity,
        status: order.materialsReadiness,
      });
    }
  }

  const stageTemplate: ProductionTaskDraft[] = [
    { title: "Підготовка карт розкрою", stage: "PREPARATION", dueAt: daysFromNow(1), assigneeRole: "PRODUCTION_CHIEF" },
    { title: "Розкрій", stage: "CUTTING", dueAt: daysFromNow(2) },
    { title: "Кромка", stage: "EDGING", dueAt: daysFromNow(3) },
    { title: "Присадка", stage: "DRILLING", dueAt: daysFromNow(4) },
    { title: "Збірка", stage: "ASSEMBLY", dueAt: daysFromNow(5) },
    { title: "Пакування", stage: "PACKING", dueAt: daysFromNow(6) },
  ];
  productionTasks.push(...stageTemplate);

  const installationPreTasks: InstallationPreTaskDraft[] = [
    { title: "Перевірити доступність об'єкта", requiredBy: daysFromNow(4) },
    { title: "Узгодити монтажне вікно з клієнтом", requiredBy: daysFromNow(5) },
  ];

  return {
    purchaseRequests,
    warehouseReservations,
    productionTasks,
    schedulePlaceholders: [
      { title: "Старт виробництва", date: daysFromNow(1) },
      { title: "Плановий монтаж", date: order.plannedInstallationAt ?? daysFromNow(8) },
    ],
    installationPreTasks,
  };
}
