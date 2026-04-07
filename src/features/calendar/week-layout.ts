import type { CalendarEvent } from "./types";

/** Жадібне призначення колонок; кількість колонок = фактичний максимум одночасних подій. */
export function assignEventColumns(events: CalendarEvent[]): Map<
  string,
  { col: number; cols: number }
> {
  const sorted = [...events].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
  const laneEnd: number[] = [];
  const map = new Map<string, { col: number; cols: number }>();
  for (const ev of sorted) {
    const st = new Date(ev.startAt).getTime();
    const en = new Date(ev.endAt).getTime();
    let c = laneEnd.findIndex((end) => st >= end);
    if (c === -1) {
      c = laneEnd.length;
      laneEnd.push(en);
    } else {
      laneEnd[c] = en;
    }
    map.set(ev.id, { col: c, cols: 0 });
  }
  const cols = Math.max(1, laneEnd.length);
  for (const ev of sorted) {
    const prev = map.get(ev.id)!;
    map.set(ev.id, { col: prev.col, cols });
  }
  return map;
}

export function eventPercentInDayGrid(
  ev: CalendarEvent,
  day: Date,
  firstHour: number,
  hourCount: number,
): { top: number; height: number } | null {
  const gridStart = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    firstHour,
    0,
    0,
    0,
  );
  const gridEnd = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    firstHour + hourCount,
    0,
    0,
    0,
  );
  const es = new Date(ev.startAt);
  const ee = new Date(ev.endAt);
  if (ee.getTime() <= gridStart.getTime() || es.getTime() >= gridEnd.getTime()) {
    return null;
  }
  const visStart = Math.max(es.getTime(), gridStart.getTime());
  const visEnd = Math.min(ee.getTime(), gridEnd.getTime());
  const total = gridEnd.getTime() - gridStart.getTime();
  const top = ((visStart - gridStart.getTime()) / total) * 100;
  const height = ((visEnd - visStart) / total) * 100;
  return { top, height: Math.max(height, 4) };
}
