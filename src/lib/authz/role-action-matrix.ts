import type { Role } from "@prisma/client";

export type ScopeModel = "global" | "team" | "own" | "assigned_measurements" | "operations_global";

export type RoleActionProfile = {
  role: Role | "MANAGER" | "USER" | "TEAM_LEAD";
  view: string[];
  actions: string[];
  scope: ScopeModel;
  assign: string[];
};

export const ROLE_ACTION_MATRIX: Record<string, RoleActionProfile> = {
  SUPER_ADMIN: {
    role: "SUPER_ADMIN",
    view: ["all_modules", "all_settings", "all_reports"],
    actions: ["all_crud", "impersonation", "roles_manage", "users_manage"],
    scope: "global",
    assign: ["all_roles"],
  },
  ADMIN: {
    role: "ADMIN",
    view: ["all_modules", "all_settings", "all_reports"],
    actions: ["all_crud_except_roles_matrix"],
    scope: "global",
    assign: ["manager_roles", "operations_roles", "head_manager", "director_production"],
  },
  DIRECTOR: {
    role: "DIRECTOR",
    view: ["all_modules", "all_settings", "all_reports"],
    actions: ["all_crud", "strategic_review"],
    scope: "global",
    assign: ["all_roles_except_super_admin"],
  },
  DIRECTOR_PRODUCTION: {
    role: "DIRECTOR_PRODUCTION",
    view: ["production", "constructor", "warehouse", "deals", "tasks", "reports"],
    actions: ["production_orchestration_manage", "task_manage", "handoff_accept"],
    scope: "global",
    assign: ["production_roles", "constructor", "workshop_roles"],
  },
  HEAD_MANAGER: {
    role: "HEAD_MANAGER",
    view: ["dashboard", "leads", "deals", "contacts", "inbox", "calendar", "tasks", "files", "reports"],
    actions: ["lead_crud", "deal_crud", "messaging", "lead_assign", "deal_assign", "team_coordination"],
    scope: "team",
    assign: ["SALES_MANAGER", "MANAGER", "USER"],
  },
  TEAM_LEAD: {
    role: "TEAM_LEAD",
    view: ["dashboard", "leads", "deals", "contacts", "inbox", "calendar", "tasks", "files", "reports"],
    actions: ["lead_crud", "deal_crud", "messaging", "lead_assign", "deal_assign"],
    scope: "team",
    assign: ["SALES_MANAGER", "MANAGER", "USER"],
  },
  SALES_MANAGER: {
    role: "SALES_MANAGER",
    view: ["dashboard", "leads", "deals", "contacts", "inbox", "calendar", "tasks", "files", "reports"],
    actions: ["lead_crud", "deal_crud", "task_crud", "messaging", "estimate_quote_contract"],
    scope: "own",
    assign: ["self_or_team_if_has_assign_permission"],
  },
  MANAGER: {
    role: "MANAGER",
    view: ["dashboard", "leads", "deals", "contacts", "inbox", "calendar", "tasks", "files", "reports"],
    actions: ["legacy_alias_of_head_manager"],
    scope: "team",
    assign: ["SALES_MANAGER", "MANAGER", "USER"],
  },
  USER: {
    role: "USER",
    view: ["dashboard", "leads", "deals", "contacts", "inbox", "calendar", "tasks", "files", "reports"],
    actions: ["legacy_alias_of_sales_manager"],
    scope: "own",
    assign: ["self_or_team_if_has_assign_permission"],
  },
  MEASURER: {
    role: "MEASURER",
    view: ["dashboard", "calendar", "tasks", "assigned_leads"],
    actions: ["measurement_updates", "task_updates"],
    scope: "assigned_measurements",
    assign: [],
  },
  ACCOUNTANT: {
    role: "ACCOUNTANT",
    view: ["finance", "deals", "reports", "dashboard", "files"],
    actions: ["payments", "journal", "financial_reporting"],
    scope: "operations_global",
    assign: [],
  },
  PROCUREMENT_MANAGER: {
    role: "PROCUREMENT_MANAGER",
    view: ["procurement", "warehouse", "production", "deals", "reports"],
    actions: ["purchase_workflow", "supplier_ops", "stock_movements"],
    scope: "operations_global",
    assign: [],
  },
  PRODUCTION_WORKER: {
    role: "PRODUCTION_WORKER",
    view: ["production", "deals_workspace", "tasks", "files"],
    actions: ["task_updates", "file_uploads"],
    scope: "operations_global",
    assign: [],
  },
  CUTTING: {
    role: "CUTTING",
    view: ["production", "tasks", "files", "deals_workspace"],
    actions: ["cutting_stage_updates"],
    scope: "operations_global",
    assign: [],
  },
  EDGING: {
    role: "EDGING",
    view: ["production", "tasks", "files", "deals_workspace"],
    actions: ["edging_stage_updates"],
    scope: "operations_global",
    assign: [],
  },
  DRILLING: {
    role: "DRILLING",
    view: ["production", "tasks", "files", "deals_workspace"],
    actions: ["drilling_stage_updates"],
    scope: "operations_global",
    assign: [],
  },
  ASSEMBLY: {
    role: "ASSEMBLY",
    view: ["production", "tasks", "files", "deals_workspace", "handoff"],
    actions: ["assembly_stage_updates", "handoff_accept", "file_uploads"],
    scope: "operations_global",
    assign: [],
  },
  CONSTRUCTOR: {
    role: "CONSTRUCTOR",
    view: ["constructor", "production", "deals_workspace", "tasks", "files"],
    actions: ["constructor_workspace_manage", "production_orchestration_manage"],
    scope: "operations_global",
    assign: [],
  },
};

export function getRoleActionProfile(role: string): RoleActionProfile {
  return ROLE_ACTION_MATRIX[role] ?? ROLE_ACTION_MATRIX.SALES_MANAGER;
}

