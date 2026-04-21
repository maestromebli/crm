import type {
  AssistantResolvedContext,
  AssistantVisualState,
} from "../types";

export function getAssistantGreeting(ctx: AssistantResolvedContext): string {
  if (ctx.entityTitle) {
    return `Вітаю. Працюємо з «${ctx.entityTitle}» — підкажу наступні кроки.`;
  }
  switch (ctx.contextKind) {
    case "dashboard":
      return "Вітаю. Коротко підкажу пріоритети та зони уваги на сьогодні.";
    case "lead":
      return "Вітаю. Допоможу з кваліфікацією ліда та наступним контактом.";
    case "deal":
      return "Вітаю. Тримаємо замовлення під контролем — від КП до передачі.";
    case "calculation":
      return "Вітаю. Поясню версії розрахунку та активну КП.";
    case "quote":
      return "Вітаю. Нагадаю про статус КП та follow-up.";
    case "contract":
      return "Вітаю. Перевіримо готовність до договору та документів.";
    case "calendar":
      return "Вітаю. Допоможу з планом виїздів і подій.";
    default:
      return "Вітаю. Можу коротко проаналізувати ситуацію, нагадати про задачі та наступні кроки — запитайте або оберіть швидку дію.";
  }
}

export function getAssistantStatusLabel(
  state: AssistantVisualState,
  loading: boolean,
  error: boolean,
): string {
  if (loading) return "Обробляю запит…";
  if (error) return "Потрібна увага";
  switch (state) {
    case "thinking":
      return "Думаю…";
    case "speaking":
      return "Відповідаю…";
    case "listening":
      return "Готовий до запиту…";
    case "warning":
      return "Є рекомендації";
    case "error":
      return "Помилка";
    case "sleeping":
      return "У фоні";
    case "success":
      return "Готово";
    default:
      return "На зв’язку";
  }
}

export function getAssistantTooltip(ctx: AssistantResolvedContext): string {
  if (ctx.recommendationCount > 1) return "Є рекомендації";
  if (ctx.nextBestAction) return "Потрібна дія";
  if (ctx.recommendationCount === 1) return "Є рекомендація";
  return "AI готовий допомогти";
}

export function getAssistantNextBestActionText(
  ctx: AssistantResolvedContext,
): string | null {
  return ctx.nextBestAction ?? null;
}

export function getAssistantRecommendationSummary(
  ctx: AssistantResolvedContext,
): string {
  const n = ctx.recommendationCount;
  if (n === 0) return "Я готовий підказати наступні кроки в цьому розділі.";
  if (n === 1) return "Я знайшов одну річ, на яку варто звернути увагу.";
  return `Я знайшов ${n} речі, які варто врахувати перед наступним кроком.`;
}
