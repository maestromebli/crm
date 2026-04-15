"use client";

import type { CalculationAIInput, CalculationAISuggestion } from "./calculationAIEngine";

type MaterialPreset = {
  match: RegExp;
  material: string;
  coeff: number;
  price: number;
  type: "material" | "fitting" | "service" | "measurement";
  note: string;
};

const MATERIAL_PRESETS: MaterialPreset[] = [
  {
    match: /дсп|egger/i,
    material: "ДСП Egger 18мм",
    coeff: 1.15,
    price: 1280,
    type: "material",
    note: "Рекомендована товщина 18мм для корпусу.",
  },
  {
    match: /мдф|фарб/i,
    material: "МДФ фарбований 19мм",
    coeff: 1.25,
    price: 1890,
    type: "material",
    note: "Для фасадів рекомендована грунтовка + фарбування.",
  },
  {
    match: /направляюч|blum/i,
    material: "Направляючі Blum Tandem",
    coeff: 1,
    price: 980,
    type: "fitting",
    note: "Додайте комплект на кожен висувний елемент.",
  },
];

function estimateComplexityScore(input: CalculationAIInput): number {
  const rowCountScore = Math.min(4, Math.floor(input.rows.length / 8));
  const typeCount = new Set(input.rows.map((r) => r.type)).size;
  const typeScore = Math.min(3, typeCount);
  const budgetRiskScore = input.dealContext.budgetText ? 0 : 1;
  return rowCountScore + typeScore + budgetRiskScore;
}

function suggestedMarginPercent(input: CalculationAIInput): number {
  const complexity = estimateComplexityScore(input);
  const base = 24;
  const byComplexity = complexity * 2;
  const forCompanyClient = input.dealContext.clientType === "COMPANY" ? 2 : 0;
  return Math.max(18, Math.min(38, base + byComplexity + forCompanyClient));
}

function buildAutofillSuggestions(input: CalculationAIInput): CalculationAISuggestion[] {
  const out: CalculationAISuggestion[] = [];
  for (const row of input.rows) {
    const normalized = row.name.trim();
    if (!normalized) continue;
    const preset = MATERIAL_PRESETS.find((p) => p.match.test(normalized));
    if (!preset) continue;
    if (row.price > 0 && row.coeff > 0.1) continue;
    out.push({
      id: `autofill:${row.id}:${preset.material}`,
      type: "autofill",
      title: `Автозаповнення: ${preset.material}`,
      message: `${preset.note} Заповнити коефіцієнт і ціну автоматично.`,
      rowId: row.id,
      patch: {
        type: preset.type,
        coeff: preset.coeff,
        price: preset.price,
      },
      confidence: 0.92,
    });
  }
  return out;
}

function buildPricingSuggestions(input: CalculationAIInput): CalculationAISuggestion[] {
  const out: CalculationAISuggestion[] = [];
  const targetMargin = suggestedMarginPercent(input);
  const currentMargin = input.totals.marginPercent;
  if (currentMargin < targetMargin - 4) {
    out.push({
      id: "pricing:raise-margin",
      type: "pricing",
      title: "Підвищити націнку",
      message: `Поточна маржа ${currentMargin.toFixed(1)}% нижча за рекомендовану ${targetMargin.toFixed(1)}%.`,
      confidence: 0.88,
    });
  }
  if (currentMargin > targetMargin + 10) {
    out.push({
      id: "pricing:too-high",
      type: "pricing",
      title: "Перевірити завищення ціни",
      message: `Маржа ${currentMargin.toFixed(1)}% може бути зависокою для цього типу клієнта.`,
      confidence: 0.68,
    });
  }
  return out;
}

function buildStructureSuggestions(input: CalculationAIInput): CalculationAISuggestion[] {
  const out: CalculationAISuggestion[] = [];
  const rowNames = input.rows.map((x) => x.name.toLowerCase());
  const hasGuides = rowNames.some((x) => x.includes("направля"));
  const hasEdge = rowNames.some((x) => x.includes("кром"));
  const hasInstall = rowNames.some((x) => x.includes("монтаж"));

  if (!hasGuides) {
    out.push({
      id: "structure:guides",
      type: "structure",
      title: "Не додано направляючі",
      message: "⚠ Для висувних секцій зазвичай потрібні направляючі.",
      confidence: 0.87,
    });
  }
  if (!hasEdge) {
    out.push({
      id: "structure:edge",
      type: "structure",
      title: "Немає кромки",
      message: "⚠ Перевірте кромку фасадів і видимих торців.",
      confidence: 0.91,
    });
  }
  if (!hasInstall) {
    out.push({
      id: "structure:install",
      type: "structure",
      title: "Не враховано монтаж",
      message: "⚠ Додайте монтаж як окремий сервісний рядок.",
      confidence: 0.9,
    });
  }
  return out;
}

export function buildCalculationAISuggestions(input: CalculationAIInput): CalculationAISuggestion[] {
  return [
    ...buildAutofillSuggestions(input),
    ...buildPricingSuggestions(input),
    ...buildStructureSuggestions(input),
  ].slice(0, 16);
}
