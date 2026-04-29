import type { PermissionKey, Role } from "@prisma/client";
import rawContract from "../../../config/rbac-role-policy.json";

type RuleMode = "ALL" | "ALL_EXCEPT" | "SET";

type ContractRule = {
  mode: RuleMode;
  exclude?: PermissionKey[];
  set?: string;
};

type ContractShape = {
  permissionKeys: PermissionKey[];
  namedPermissionSets: Record<string, PermissionKey[]>;
  roleRules: Record<string, ContractRule>;
  defaultRule: ContractRule;
};

const contract = rawContract as ContractShape;

export const RBAC_ALL_PERMISSION_KEYS: readonly PermissionKey[] =
  contract.permissionKeys;

export const RBAC_NAMED_PERMISSION_SETS: Readonly<
  Record<string, readonly PermissionKey[]>
> = contract.namedPermissionSets;

export type DefaultPermissionMode = "ALL" | PermissionKey[];

function resolveRule(rule: ContractRule): DefaultPermissionMode {
  if (rule.mode === "ALL") return "ALL";
  if (rule.mode === "ALL_EXCEPT") {
    const excluded = new Set(rule.exclude ?? []);
    return RBAC_ALL_PERMISSION_KEYS.filter((key) => !excluded.has(key));
  }
  const setName = rule.set ?? "";
  const setValues = RBAC_NAMED_PERMISSION_SETS[setName];
  return setValues ? [...setValues] : [];
}

export function getContractPermissionModeForRole(
  role: Role | string,
): DefaultPermissionMode {
  const rule =
    contract.roleRules[String(role)] ??
    contract.defaultRule;
  return resolveRule(rule);
}

