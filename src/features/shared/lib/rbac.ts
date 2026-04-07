import type { CrmRole } from "../../finance/types/models";

type ModuleArea = "FINANCE_FULL" | "FINANCE_SUMMARY" | "PROCUREMENT_FULL" | "PROCUREMENT_SUMMARY";

const rules: Record<CrmRole, ModuleArea[]> = {
  DIRECTOR: ["FINANCE_FULL", "FINANCE_SUMMARY", "PROCUREMENT_FULL", "PROCUREMENT_SUMMARY"],
  HEAD_MANAGER: ["FINANCE_FULL", "FINANCE_SUMMARY", "PROCUREMENT_FULL", "PROCUREMENT_SUMMARY"],
  ACCOUNTANT: ["FINANCE_FULL", "PROCUREMENT_SUMMARY", "FINANCE_SUMMARY"],
  PROCUREMENT_MANAGER: ["PROCUREMENT_FULL", "PROCUREMENT_SUMMARY", "FINANCE_SUMMARY"],
  SALES_MANAGER: ["FINANCE_SUMMARY", "PROCUREMENT_SUMMARY"],
};

export function canAccess(role: CrmRole, area: ModuleArea): boolean {
  return rules[role].includes(area);
}

export function resolveRole(input?: string): CrmRole {
  switch (input) {
    case "DIRECTOR":
    case "HEAD_MANAGER":
    case "ACCOUNTANT":
    case "PROCUREMENT_MANAGER":
    case "SALES_MANAGER":
      return input;
    default:
      return "SALES_MANAGER";
  }
}

