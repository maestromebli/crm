function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export const ENVER_FEATURE_FLAGS = {
  platformContractsV1: envFlag("ENVER_FF_PLATFORM_CONTRACTS_V1", false),
  dealProductionPolicyV1: envFlag("ENVER_FF_DEAL_PRODUCTION_POLICY_V1", true),
  workflowGovernanceApiV1: envFlag("ENVER_FF_WORKFLOW_GOVERNANCE_API_V1", true),
} as const;

