/** Локалізовані підписи для журналу складу. */

export const WAREHOUSE_MOVEMENT_KIND_UK: Record<string, string> = {
  RECEIPT: "Надходження",
  ISSUE: "Видача",
  TRANSFER: "Переміщення",
  ADJUSTMENT: "Коригування",
  RESERVE: "Резерв",
  UNRESERVE: "Зняття резерву",
};

export const WAREHOUSE_REF_KIND_UK: Record<string, string> = {
  PURCHASE_ORDER: "PO",
  PRODUCTION_TASK: "Задача цеху",
  PRODUCTION_FLOW: "Потік",
  MANUAL: "Вручну",
  DEAL: "Замовлення",
};

export function movementKindLabel(kind: string): string {
  return WAREHOUSE_MOVEMENT_KIND_UK[kind] ?? kind;
}

export function refKindLabel(kind: string | null): string {
  if (!kind) return "—";
  return WAREHOUSE_REF_KIND_UK[kind] ?? kind;
}
