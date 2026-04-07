/** Спільна логіка для панелі «Конструктори» та API експорту. */

export type ConstructorBoardFilterId =
  | "all"
  | "no_room"
  | "active"
  | "done"
  | "overdue";

export type ConstructorRoomForFilter = {
  status: string;
  dueAt: string | null;
};

export type ConstructorBoardRowForFilter = {
  title: string;
  clientName: string;
  room: ConstructorRoomForFilter | null;
};

export function isConstructorSlaOverdue(
  room: ConstructorRoomForFilter | null,
): boolean {
  if (!room?.dueAt) return false;
  if (room.status === "REVIEWED" || room.status === "DELIVERED") return false;
  return new Date(room.dueAt).getTime() < Date.now();
}

export function parseConstructorBoardFilter(
  raw: string | null,
): ConstructorBoardFilterId {
  if (
    raw === "no_room" ||
    raw === "active" ||
    raw === "done" ||
    raw === "overdue"
  ) {
    return raw;
  }
  return "all";
}

export function matchesConstructorBoardFilter(
  row: ConstructorBoardRowForFilter,
  needle: string,
  filter: ConstructorBoardFilterId,
): boolean {
  const n = needle.trim().toLowerCase();
  if (n) {
    const hay = `${row.title} ${row.clientName}`.toLowerCase();
    if (!hay.includes(n)) return false;
  }
  const r = row.room;
  switch (filter) {
    case "no_room":
      return !r;
    case "active":
      return !!(
        r &&
        r.status !== "REVIEWED" &&
        r.status !== "DELIVERED"
      );
    case "done":
      return !!(
        r &&
        (r.status === "REVIEWED" || r.status === "DELIVERED")
      );
    case "overdue":
      return isConstructorSlaOverdue(r);
    default:
      return true;
  }
}
