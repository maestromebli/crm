import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractPath = path.resolve(__dirname, "../config/rbac-role-policy.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8"));

function fail(message) {
  console.error(`[rbac:scenarios] ${message}`);
  process.exit(1);
}

function resolveRoleKeys(role) {
  const rule = contract.roleRules?.[role] ?? contract.defaultRule;
  if (!rule) return [];
  if (rule.mode === "ALL") return [...contract.permissionKeys];
  if (rule.mode === "ALL_EXCEPT") {
    const excluded = new Set(rule.exclude ?? []);
    return contract.permissionKeys.filter((k) => !excluded.has(k));
  }
  if (rule.mode === "SET") {
    return [...(contract.namedPermissionSets?.[rule.set ?? ""] ?? [])];
  }
  return [];
}

function assertHas(role, key) {
  const keys = new Set(resolveRoleKeys(role));
  if (!keys.has(key)) fail(`${role} must include ${key}`);
}

function assertMissing(role, key) {
  const keys = new Set(resolveRoleKeys(role));
  if (keys.has(key)) fail(`${role} must not include ${key}`);
}

// Core sales leadership scenarios
assertHas("HEAD_MANAGER", "DASHBOARD_VIEW");
assertHas("HEAD_MANAGER", "LEADS_ASSIGN");
assertHas("HEAD_MANAGER", "DEALS_ASSIGN");
assertMissing("HEAD_MANAGER", "USERS_MANAGE");
assertMissing("HEAD_MANAGER", "ROLES_MANAGE");

// Sales manager baseline
assertHas("SALES_MANAGER", "LEADS_VIEW");
assertHas("SALES_MANAGER", "DEALS_VIEW");
assertMissing("SALES_MANAGER", "USERS_MANAGE");
assertMissing("SALES_MANAGER", "ROLES_MANAGE");

// Admin split from SUPER_ADMIN
assertHas("ADMIN", "USERS_MANAGE");
assertMissing("ADMIN", "ROLES_MANAGE");
assertHas("SUPER_ADMIN", "ROLES_MANAGE");

// Operations roles
assertHas("ACCOUNTANT", "PAYMENTS_VIEW");
assertHas("PROCUREMENT_MANAGER", "COST_VIEW");
assertHas("CONSTRUCTOR", "PRODUCTION_ORCHESTRATION_MANAGE");

console.log("[rbac:scenarios] role scenario checks passed");

