import type { AssistantPageEntitySnapshot } from "../context/AssistantPageEntityContext";
import type {
  AssistantRecommendation,
  AssistantResolvedContext,
} from "../types";

function dedupeRecommendations(
  list: AssistantRecommendation[],
): AssistantRecommendation[] {
  const seen = new Set<string>();
  const out: AssistantRecommendation[] = [];
  for (const r of list) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

/**
 * Накладає дані зі сторінки (лід/замовлення) на базовий резолв без зміни маршрутної логіки.
 */
export function mergePageEntityIntoResolved(
  base: AssistantResolvedContext,
  entity: AssistantPageEntitySnapshot | null,
): AssistantResolvedContext {
  if (!entity) return base;

  const recommendations = [...base.recommendations];

  if (entity.staleSinceHours != null && entity.staleSinceHours >= 48) {
    const days = Math.floor(entity.staleSinceHours / 24);
    recommendations.push({
      id: "page-entity-stale",
      title: "Тривалий інтервал без активності",
      description:
        days >= 1
          ? `Остання активність понад ${days} дн. тому — варто ініціювати контакт.`
          : "Давно не було руху по об’єкту — перевірте наступний крок.",
      level: "warning",
    });
  }

  if (entity.overdueTasks > 0) {
    recommendations.push({
      id: "page-entity-overdue",
      title: "Прострочені задачі",
      description: `${entity.overdueTasks} задач потребують уваги.`,
      level: "warning",
    });
  }

  if (entity.missingFieldLabels.length > 0) {
    recommendations.push({
      id: "page-entity-missing",
      title: "Незаповнені обов’язкові поля",
      description: entity.missingFieldLabels.slice(0, 4).join(", "),
      level: "warning",
    });
  }

  const mergedRecs = dedupeRecommendations(recommendations);

  return {
    ...base,
    entityId: entity.entityId,
    entityTitle: entity.title,
    status: entity.statusLabel,
    missingFields: entity.missingFieldLabels,
    overdueTasks: entity.overdueTasks,
    staleSinceHours: entity.staleSinceHours,
    quoteStatus: entity.quoteStatus,
    paymentStatus: entity.paymentStatus,
    recommendations: mergedRecs,
    recommendationCount: mergedRecs.length,
  };
}
