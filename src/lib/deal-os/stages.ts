export const ENVER_STAGE_SEQUENCE = [
  "Нові",
  "Контакт",
  "Замір",
  "Розрахунок",
  "КП",
  "Надіслані",
  "Погоджені",
  "Договір",
  "Оплата",
  "Закупка",
  "Виробництво",
  "Доставка",
  "Монтаж",
  "Завершено",
] as const;

export type EnverStageName = (typeof ENVER_STAGE_SEQUENCE)[number];

function norm(input: string): string {
  return input.trim().toLowerCase();
}

const STAGE_ALIASES: Record<string, EnverStageName> = {
  "нові": "Нові",
  "new": "Нові",
  "new_deal": "Нові",
  "контакт": "Контакт",
  "contact": "Контакт",
  "qualification": "Контакт",
  "замір": "Замір",
  "measurement": "Замір",
  "control_measurement": "Замір",
  "розрахунок": "Розрахунок",
  "calculation": "Розрахунок",
  "estimate": "Розрахунок",
  "кп": "КП",
  "proposal": "КП",
  "quote_draft": "КП",
  "надіслані": "Надіслані",
  "sent": "Надіслані",
  "quote_sent": "Надіслані",
  "погоджені": "Погоджені",
  "approved": "Погоджені",
  "договір": "Договір",
  "contract": "Договір",
  "contract_preparation": "Договір",
  "contract_signed": "Договір",
  "оплата": "Оплата",
  "payment": "Оплата",
  "awaiting_prepayment": "Оплата",
  "закупка": "Закупка",
  "procurement": "Закупка",
  "виробництво": "Виробництво",
  "production": "Виробництво",
  "in_production_preparation": "Виробництво",
  "in_production": "Виробництво",
  "доставка": "Доставка",
  "delivery": "Доставка",
  "монтаж": "Монтаж",
  "installation": "Монтаж",
  "завершено": "Завершено",
  "done": "Завершено",
  "completed": "Завершено",
  "closed": "Завершено",
};

export function normalizeEnverStage(
  source: string | null | undefined,
): EnverStageName | null {
  if (!source?.trim()) return null;
  const byAlias = STAGE_ALIASES[norm(source)];
  if (byAlias) return byAlias;
  return null;
}

export function getEnverStageIndex(stage: EnverStageName): number {
  return ENVER_STAGE_SEQUENCE.indexOf(stage);
}

export function nextEnverStage(
  stage: EnverStageName,
): EnverStageName | null {
  const i = getEnverStageIndex(stage);
  if (i < 0 || i >= ENVER_STAGE_SEQUENCE.length - 1) return null;
  return ENVER_STAGE_SEQUENCE[i + 1];
}
