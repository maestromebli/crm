/**
 * Серверні експорти AI V2 (Prisma, pg). Не імпортувати з "use client" компонентів —
 * використовуйте `@/features/ai-v2` для UI та типів.
 */
export * from "./core/types";
export * from "./core/events";
export {
  buildAiV2ActorContext,
  canReadAiV2Context,
  canRunAiV2Action,
} from "./guard/rbac-guard";
export { buildAiV2ContextSnapshot } from "./context/context-builder";
export { runAiV2DecisionEngine } from "./decision/decision-engine";
export {
  buildAiV2ActionPlan,
  executeAiV2LowRiskActions,
} from "./action/action-layer";
export { buildAiV2MemorySnapshot } from "./memory/memory-service";
export { publishAiV2Event, subscribeAiV2Event } from "./observer/event-bus";
export { logAiV2InsightRun } from "./audit/ai-v2-audit";
