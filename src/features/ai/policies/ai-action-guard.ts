import { hasEffectivePermission, P } from "@/lib/authz/permissions";

type GuardUser = {
  permissionKeys: string[];
  realRole: string;
  impersonatorId?: string;
};

type GuardInput = {
  user: GuardUser;
  operation: string;
};

export type AiExecutionPolicy = {
  allowed: boolean;
  advisoryOnly: boolean;
  reason: string | null;
};

function permCtx(user: GuardUser) {
  return { realRole: user.realRole, impersonatorId: user.impersonatorId };
}

export function resolveAiExecutionPolicy(input: GuardInput): AiExecutionPolicy {
  const ctx = permCtx(input.user);
  const canUseAi = hasEffectivePermission(input.user.permissionKeys, P.AI_USE, ctx);
  if (!canUseAi) {
    return { allowed: false, advisoryOnly: true, reason: "AI_USE required" };
  }

  // Current AI operations endpoint is advisory by contract; no direct state mutation here.
  const privilegedActionRights =
    hasEffectivePermission(input.user.permissionKeys, P.DEALS_UPDATE, ctx) ||
    hasEffectivePermission(input.user.permissionKeys, P.LEADS_UPDATE, ctx);

  return {
    allowed: true,
    advisoryOnly: !privilegedActionRights,
    reason: null,
  };
}
