import {
  parseEstimatePromptToDraft,
  type AiEstimateDraftResult,
} from "../estimates/ai-estimate-draft";
import type { ParsedEstimateDraft } from "./types";

function draftToParsed(raw: AiEstimateDraftResult): ParsedEstimateDraft {
  const inferred =
    raw.lines[0]?.category ??
    (raw.assumptions.find((a) => a.startsWith("Тип проєкту:"))
      ? raw.assumptions
          .find((a) => a.startsWith("Тип проєкту:"))!
          .replace(/^Тип проєкту:\s*/i, "")
          .trim()
      : undefined);

  const summary =
    raw.assumptions.length > 0
      ? raw.assumptions.join(" · ")
      : raw.lines[0]?.productName ?? "Чернетка з тексту";

  const suggestedItems = raw.lines.map((li) => ({
    category: li.category ?? "Загальне",
    title: li.productName,
    qty: li.qty,
    unit: li.unit,
    suggestedUnitPrice: li.qty > 0 ? li.salePrice : null,
    supplierHints: undefined,
  }));

  const warnings: string[] = [];
  for (const a of raw.assumptions) {
    if (/цін|ризик|не впевн/i.test(a)) warnings.push(a);
  }

  return {
    summary,
    inferredProjectType: inferred,
    suggestedItems,
    missingSuggestions: raw.missing,
    warnings,
  };
}

/**
 * Вільний текст → структурована чернетка (§4.1). База — евристики `parseEstimatePromptToDraft`.
 */
export function parseEstimateFreeTextToDraft(text: string): ParsedEstimateDraft {
  return draftToParsed(parseEstimatePromptToDraft(text));
}

export type EstimateAnomalyInput = {
  totalPrice: number | null;
  lineCount: number;
  inferredKitchenOrLarge: boolean;
};

/** Приклади аномалій для UI (§4.4) — не блокує збереження. */
export function detectEstimateAnomalies(
  input: EstimateAnomalyInput,
): string[] {
  const w: string[] = [];
  if (input.inferredKitchenOrLarge && input.totalPrice != null && input.totalPrice < 5000) {
    w.push("Загальна сума незвично мала для кухні / великого проєкту — перевірте позиції.");
  }
  if (input.lineCount > 0 && input.totalPrice === 0) {
    w.push("Нульова сума при наявних рядках — перевірте ціни.");
  }
  return w;
}

export type EstimateMissingItemsInput = {
  inferredKitchen: boolean;
  hasInstallationLine: boolean;
  hasDeliveryLine: boolean;
  hasFittingsLine: boolean;
  hasCountertopLine: boolean;
};

/** Компактні попередження про пропуски (§4.3). */
export function suggestEstimateMissingItems(
  input: EstimateMissingItemsInput,
): string[] {
  const w: string[] = [];
  if (!input.hasFittingsLine) w.push("Фурнітура не виділена окремо");
  if (!input.hasInstallationLine) w.push("Монтаж не включено");
  if (!input.hasDeliveryLine) w.push("Доставка не включена");
  if (input.inferredKitchen && !input.hasCountertopLine) {
    w.push("Для кухні часто потрібна стільниця — перевірте склад");
  }
  return w;
}
