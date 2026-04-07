/**
 * Стадії цехового Kanban: єдині ключі та підписи для API, штабу та міні-штабів дільниць.
 */

export const WORKSHOP_KANBAN_STAGE_KEYS = [
  "CUTTING",
  "EDGING",
  "DRILLING",
  "ASSEMBLY",
  "PAINTING",
  "PACKAGING",
] as const;

export type WorkshopKanbanStageKey = (typeof WORKSHOP_KANBAN_STAGE_KEYS)[number];

/** Підписи дільниць українською (для операторів цеху). */
export const WORKSHOP_STAGE_LABEL_UK: Record<WorkshopKanbanStageKey, string> = {
  CUTTING: "Порізка",
  EDGING: "Поклейка",
  DRILLING: "Присадка",
  ASSEMBLY: "Збірка",
  PAINTING: "Фарбування",
  PACKAGING: "Пакування",
};

/** Дільниці з окремим «міні-штабом»: одна колонка, можна відкрити у вікні. */
export const WORKSHOP_MINI_HQ_STAGE_KEYS: readonly WorkshopKanbanStageKey[] = [
  "CUTTING",
  "EDGING",
  "DRILLING",
  "ASSEMBLY",
] as const;

export const WORKSHOP_KANBAN_COLUMNS: readonly { key: WorkshopKanbanStageKey; label: string }[] =
  WORKSHOP_KANBAN_STAGE_KEYS.map((key) => ({ key, label: WORKSHOP_STAGE_LABEL_UK[key] }));

/** Fallback для stationLoads у БД (ключі станцій латиницею). */
export const WORKSHOP_STATION_LABEL_BY_KEY: Record<string, string> = {
  cutting: WORKSHOP_STAGE_LABEL_UK.CUTTING,
  edging: WORKSHOP_STAGE_LABEL_UK.EDGING,
  drilling: WORKSHOP_STAGE_LABEL_UK.DRILLING,
  assembly: WORKSHOP_STAGE_LABEL_UK.ASSEMBLY,
  painting: WORKSHOP_STAGE_LABEL_UK.PAINTING,
  packaging: WORKSHOP_STAGE_LABEL_UK.PACKAGING,
};

/** URL-сегмент після `/crm/production/workshop/` */
export const WORKSHOP_STAGE_SLUG: Record<WorkshopKanbanStageKey, string> = {
  CUTTING: "cutting",
  EDGING: "edging",
  DRILLING: "drilling",
  ASSEMBLY: "assembly",
  PAINTING: "painting",
  PACKAGING: "packaging",
};

const SLUG_TO_STAGE_KEY: Record<string, WorkshopKanbanStageKey> = Object.fromEntries(
  WORKSHOP_KANBAN_STAGE_KEYS.map((k) => [WORKSHOP_STAGE_SLUG[k], k]),
) as Record<string, WorkshopKanbanStageKey>;

export function workshopStageHref(stageKey: WorkshopKanbanStageKey): string {
  return `/crm/production/workshop/${WORKSHOP_STAGE_SLUG[stageKey]}`;
}

/** Розпізнавання сегмента маршруту `.../workshop/[stageSlug]`. */
export function stageKeyFromSlug(slug: string): WorkshopKanbanStageKey | null {
  if (!slug) return null;
  return SLUG_TO_STAGE_KEY[slug.toLowerCase()] ?? null;
}

/** Старі посилання з `?stage=CUTTING` — тільки для редіректу. */
export function parseWorkshopStageParam(value: string | null): WorkshopKanbanStageKey | null {
  if (!value) return null;
  const key = value.toUpperCase() as WorkshopKanbanStageKey;
  return WORKSHOP_STAGE_LABEL_UK[key] ? key : null;
}
