import { hasEffectivePermission, type Phase1Permission, P } from "./permissions";

type PermCtx = {
  realRole?: string;
  impersonatorId?: string | null;
};

/** Чи дозволено викликати AI з узагальненими показниками компанії / команди. */
export function canUseAiAnalytics(
  granted: string[] | undefined,
  ctx: PermCtx,
): boolean {
  return hasEffectivePermission(granted, P.AI_ANALYTICS, ctx);
}

/** Базове використання AI (підказки, стислі огляди). */
export function canUseAi(granted: string[] | undefined, ctx: PermCtx): boolean {
  return hasEffectivePermission(granted, P.AI_USE, ctx);
}

export function assertPhasePermission(
  granted: string[] | undefined,
  required: Phase1Permission,
  ctx: PermCtx,
): boolean {
  return hasEffectivePermission(granted, required, ctx);
}

export { P };
