type PipelineEntityType = "LEAD" | "DEAL";

const FALLBACK_STAGE_NAMES: Record<PipelineEntityType, Record<string, string>> = {
  LEAD: {
    new: "Новий",
    working: "В роботі",
    qualified: "Розрахунок",
    lost: "Закритий — втрата",
    archived: "Архів",
  },
  DEAL: {
    qualification: "Кваліфікація",
    measurement: "Замір",
    proposal: "КП",
    contract: "Договір",
    payment: "Оплата",
    handoff: "Передача",
    production: "Виробництво",
    won: "Завершено",
    lost: "Закрито — втрата",
  },
};

function isCorruptedDisplayText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const questionMarks = (trimmed.match(/\?/g) ?? []).length;
  const replacementChars = (trimmed.match(/�/g) ?? []).length;
  const letters = (trimmed.match(/[A-Za-zА-Яа-яІіЇїЄєҐґ]/g) ?? []).length;
  const placeholders = questionMarks + replacementChars;
  return (
    letters === 0 &&
    placeholders >= Math.max(2, Math.floor(trimmed.length * 0.5))
  );
}

function slugToTitle(slug: string): string {
  const pretty = slug.replace(/[-_]+/g, " ").trim();
  if (!pretty) return "Етап";
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

function fallbackStageName(entityType: PipelineEntityType, slug: string): string {
  const fromMap = FALLBACK_STAGE_NAMES[entityType][slug];
  return fromMap ?? slugToTitle(slug);
}

export function sanitizePipelineStageName(input: {
  name: string;
  slug: string;
  entityType: PipelineEntityType;
}): string {
  return isCorruptedDisplayText(input.name)
    ? fallbackStageName(input.entityType, input.slug)
    : input.name;
}
