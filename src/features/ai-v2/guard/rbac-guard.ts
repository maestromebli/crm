import type { SessionUser } from "@/lib/authz/api-guard";
import { hasEffectivePermission, P, type Phase1Permission } from "@/lib/authz/permissions";
import type { AiV2ActorContext, AiV2ContextName, AiV2ActionType } from "../core/types";

export function buildAiV2ActorContext(user: SessionUser): AiV2ActorContext {
  return {
    userId: user.id,
    role: user.role,
    permissionKeys: user.permissionKeys,
    realRole: user.realRole,
    impersonatorId: user.impersonatorId,
  };
}

function hasPerm(actor: AiV2ActorContext, permission: Phase1Permission): boolean {
  return hasEffectivePermission(actor.permissionKeys, permission, {
    realRole: actor.realRole,
    impersonatorId: actor.impersonatorId,
  });
}

export function canReadAiV2Context(
  actor: AiV2ActorContext,
  context: AiV2ContextName,
): boolean {
  if (!hasPerm(actor, P.AI_USE)) return false;
  if (context === "finance") {
    return hasPerm(actor, P.PAYMENTS_VIEW) || hasPerm(actor, P.COST_VIEW);
  }
  if (context === "production") {
    return hasPerm(actor, P.PRODUCTION_ORDERS_VIEW) || hasPerm(actor, P.DEALS_VIEW);
  }
  if (context === "procurement") {
    return hasPerm(actor, P.DEALS_VIEW);
  }
  if (context === "dashboard") {
    return hasPerm(actor, P.DASHBOARD_VIEW);
  }
  return hasPerm(actor, P.LEADS_VIEW) || hasPerm(actor, P.DEALS_VIEW);
}

export function canRunAiV2Action(
  actor: AiV2ActorContext,
  actionType: AiV2ActionType,
): boolean {
  if (!hasPerm(actor, P.AI_USE)) return false;
  switch (actionType) {
    case "create_task":
    case "create_reminder":
      return hasPerm(actor, P.TASKS_CREATE);
    case "escalate_team_lead":
      return hasPerm(actor, P.TASKS_ASSIGN) || hasPerm(actor, P.DEALS_ASSIGN);
    default:
      return false;
  }
}
