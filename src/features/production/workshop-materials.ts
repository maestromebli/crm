/** Пункти чеклісту матеріалів для задач цеху (metadataJson.materialsChecklist). */

/** Категорія рядка — для відображення лише релевантних пунктів на міні-штабі дільниці. */
export type WorkshopMaterialScope =
  | "plate"
  | "parts_edge"
  | "drill_prep"
  | "assembly"
  | "paint"
  | "pack"
  | "general";

export type WorkshopMaterialCheckItem = {
  id: string;
  label: string;
  done: boolean;
  /** Якщо задано — фільтр на міні-штабі; рядки без scope показуються на всіх екранах (спадщина). */
  scope?: WorkshopMaterialScope;
};

function nid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildDefaultMaterialsChecklist(workshopStage: string): WorkshopMaterialCheckItem[] {
  switch (workshopStage) {
    case "CUTTING":
      return [
        {
          id: nid(),
          label: "Плитні матеріали (ЛДСП / МДФ / HPL): артикули зі специфікації звірені",
          done: false,
          scope: "plate",
        },
        {
          id: nid(),
          label: "Товщина та декор плити відповідають замовленню",
          done: false,
          scope: "plate",
        },
        {
          id: nid(),
          label: "Наявність на складі або в резерві погоджено оператором порізки",
          done: false,
          scope: "plate",
        },
      ];
    case "EDGING":
      return [
        {
          id: nid(),
          label: "Готові деталі розкрою під це замовлення — комплект зі списку",
          done: false,
          scope: "parts_edge",
        },
        {
          id: nid(),
          label: "Кромка: колір, ширина, тип (ABS / ПП) — за карткою замовлення",
          done: false,
          scope: "parts_edge",
        },
        {
          id: nid(),
          label: "Кромка в наявності на дільниці / видача зі складу підтверджена",
          done: false,
          scope: "parts_edge",
        },
      ];
    case "DRILLING":
      return [
        {
          id: nid(),
          label: "Деталі пройшли порізку та поклейку (за технологією) — готові до присадки",
          done: false,
          scope: "drill_prep",
        },
        {
          id: nid(),
          label: "Креслення / програма ЧПУ узгоджені з конструкторським пакетом",
          done: false,
          scope: "drill_prep",
        },
        {
          id: nid(),
          label: "Готовність до присадки підтверджена (маркування, фурнітурний лист)",
          done: false,
          scope: "drill_prep",
        },
      ];
    case "ASSEMBLY":
      return [
        { id: nid(), label: "Фурнітура та петлі", done: false, scope: "assembly" },
        { id: nid(), label: "Кріплення, шурупи, мініфікс", done: false, scope: "assembly" },
        { id: nid(), label: "Декоративні накладки / ручки", done: false, scope: "assembly" },
        { id: nid(), label: "Комплектність за специфікацією", done: false, scope: "assembly" },
      ];
    case "PACKAGING":
      return [
        { id: nid(), label: "Захисна плівка / кутники", done: false, scope: "pack" },
        { id: nid(), label: "Маркетинг, етикетки, документи", done: false, scope: "pack" },
      ];
    case "PAINTING":
      return [
        { id: nid(), label: "Грунт / лак за карткою кольору", done: false, scope: "paint" },
        { id: nid(), label: "Контрольний зразок затверджено", done: false, scope: "paint" },
      ];
    default:
      return [
        { id: nid(), label: "Специфікація матеріалів на столі", done: false, scope: "general" },
        { id: nid(), label: "Позиції зі складу / резерв", done: false, scope: "general" },
        { id: nid(), label: "Візуальний контроль декору", done: false, scope: "general" },
      ];
  }
}

const SCOPE_BY_STAGE: Record<string, WorkshopMaterialScope | undefined> = {
  CUTTING: "plate",
  EDGING: "parts_edge",
  DRILLING: "drill_prep",
  ASSEMBLY: "assembly",
  PAINTING: "paint",
  PACKAGING: "pack",
};

export function defaultScopeForWorkshopStage(stageKey: string): WorkshopMaterialScope | undefined {
  return SCOPE_BY_STAGE[stageKey];
}

/** Пункти чеклісту, релевантні для колонки Kanban (міні-штаб показує лише «свої» рядки). */
export function filterMaterialsForWorkshopStage(
  stageKey: string,
  items: WorkshopMaterialCheckItem[],
): WorkshopMaterialCheckItem[] {
  const expected = SCOPE_BY_STAGE[stageKey];
  if (!expected) return items;
  const tagged = items.some((i) => i.scope);
  if (!tagged) return items;
  return items.filter((i) => !i.scope || i.scope === expected);
}

const SCOPES: WorkshopMaterialScope[] = [
  "plate",
  "parts_edge",
  "drill_prep",
  "assembly",
  "paint",
  "pack",
  "general",
];

function parseScope(raw: unknown): WorkshopMaterialScope | undefined {
  if (typeof raw !== "string") return undefined;
  return SCOPES.includes(raw as WorkshopMaterialScope) ? (raw as WorkshopMaterialScope) : undefined;
}

export function normalizeMaterialsChecklist(raw: unknown): WorkshopMaterialCheckItem[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkshopMaterialCheckItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : nid();
    const label = typeof o.label === "string" ? o.label : "";
    if (!label.trim()) continue;
    const scope = parseScope(o.scope);
    out.push({ id, label: label.trim(), done: Boolean(o.done), ...(scope ? { scope } : {}) });
  }
  return out;
}

/** Чи змінюється лише прогрес (done), без додавання/видалення рядків і зміни підписів. */
export function isMaterialsChecklistProgressOnly(
  existing: WorkshopMaterialCheckItem[],
  incoming: WorkshopMaterialCheckItem[],
): boolean {
  if (incoming.length !== existing.length) return false;
  const byId = new Map(existing.map((x) => [x.id, x]));
  for (const row of incoming) {
    const prev = byId.get(row.id);
    if (!prev) return false;
    if (prev.label !== row.label) return false;
    if ((prev.scope ?? "") !== (row.scope ?? "")) return false;
  }
  return true;
}
