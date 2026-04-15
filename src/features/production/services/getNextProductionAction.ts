import type { NextProductionAction, ProductionOrderOpsState } from "../types/operations-core";

function disabled(reason?: string): Pick<NextProductionAction, "disabled" | "reasonIfDisabled"> {
  return reason ? { disabled: true, reasonIfDisabled: reason } : { disabled: false };
}

export function getNextProductionAction(state: ProductionOrderOpsState): NextProductionAction {
  if (!state.constructorAssigned) {
    return {
      id: "ASSIGN_CONSTRUCTOR",
      label: "Призначити конструктора",
      description: "Створіть відповідального за креслення.",
      ...disabled(),
    };
  }

  if (!state.approvedFilesExist) {
    return {
      id: "OPEN_CONSTRUCTOR_WORKSPACE",
      label: "Відкрити робоче місце конструктора",
      description: "Надішліть конструктору лінк і дочекайтесь пакету креслень.",
      ...disabled(),
    };
  }

  if (!state.drawingsApproved) {
    return {
      id: "REVIEW_DRAWINGS",
      label: "Перевірити креслення",
      description: "Підтвердіть комплект або поверніть на доопрацювання.",
      ...disabled(state.blockers.length > 0 ? "Спочатку зніміть активні блокери." : undefined),
    };
  }

  if (!state.splitCompleted) {
    return {
      id: "SPLIT_TO_PURCHASE_AND_PRODUCTION",
      label: "Передати в закупівлю і виробництво",
      description: "Автоматично створити закупівлі, резерви, задачі цеху та pre-task монтажу.",
      ...disabled(state.blockers.length > 0 ? "Є критичні блокери." : undefined),
    };
  }

  if (state.materialsReadiness === "TO_BUY" || state.materialsReadiness === "PARTIAL") {
    return {
      id: "CONTROL_PURCHASE",
      label: "Контроль закупівлі",
      description: "Перевірте поставки, щоб не зірвати виробничий графік.",
      ...disabled(),
    };
  }

  if (state.productionStage && state.productionStage !== "READY") {
    return {
      id: "MOVE_PRODUCTION_FORWARD",
      label: "Перевести далі",
      description: "Перемістіть замовлення на наступну стадію виробництва.",
      ...disabled(),
    };
  }

  if (state.productionStage === "READY" && state.installationStatus !== "COMPLETED") {
    return {
      id: "PLAN_INSTALLATION",
      label: "Запланувати монтаж",
      description: "Зафіксуйте дату, команду і залежності монтажу.",
      ...disabled(),
    };
  }

  return {
    id: "CLOSE_ORDER",
    label: "Закрити замовлення",
    description: "Монтаж завершено, можна фіналізувати замовлення.",
    ...disabled(state.installationStatus !== "COMPLETED" ? "Монтаж ще не завершений." : undefined),
  };
}
