/**
 * Клієнт-безпечний барель: типи, RBAC без БД, UI.
 * Сервер (Prisma): `import … from "@/features/ai-v2/server"`.
 */
export * from "./core/types";
export * from "./core/events";
export {
  buildAiV2ActorContext,
  canReadAiV2Context,
  canRunAiV2Action,
} from "./guard/rbac-guard";
export { AiV2InsightCard } from "./ui/AiV2InsightCard";
export { AiV2CockpitRail } from "./ui/AiV2CockpitRail";
