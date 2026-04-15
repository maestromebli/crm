import type { DealHubRole } from "./deal.types";

export function mapEffectiveRoleToDealHubRole(
  role: string | undefined,
): DealHubRole {
  switch (role) {
    case "DIRECTOR":
    case "SUPER_ADMIN":
      return "OWNER";
    case "HEAD_MANAGER":
      return "SALES_MANAGER";
    case "PRODUCTION_MANAGER":
      return "PRODUCTION_MANAGER";
    case "FINANCIER":
      return "FINANCE";
    case "INSTALLER":
      return "INSTALLATION_COORDINATOR";
    default:
      return "MANAGER";
  }
}
