import type { CalendarEventDragPayload } from "./dnd";

/** Перенос на інший день; час доби зберігається, тривалість — та сама. */
export function rescheduleEventOnDay(
  targetDay: Date,
  payload: CalendarEventDragPayload,
): { startAt: Date; endAt: Date } {
  const oldStart = new Date(payload.startAt);
  const oldEnd = new Date(payload.endAt);
  const dur = Math.max(0, oldEnd.getTime() - oldStart.getTime());
  const start = new Date(
    targetDay.getFullYear(),
    targetDay.getMonth(),
    targetDay.getDate(),
    oldStart.getHours(),
    oldStart.getMinutes(),
    oldStart.getSeconds(),
    oldStart.getMilliseconds(),
  );
  const end = new Date(start.getTime() + (dur || 60 * 60 * 1000));
  return { startAt: start, endAt: end };
}

/** Перенос у слот години в денному вигляді. */
/** Перенос у довільний день і час (наприклад, тижнева сітка). */
export function rescheduleEventAt(
  day: Date,
  hour: number,
  minute: number,
  payload: CalendarEventDragPayload,
): { startAt: Date; endAt: Date } {
  const oldStart = new Date(payload.startAt);
  const oldEnd = new Date(payload.endAt);
  const dur = Math.max(0, oldEnd.getTime() - oldStart.getTime());
  const start = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hour,
    minute,
    0,
    0,
  );
  const end = new Date(start.getTime() + (dur || 60 * 60 * 1000));
  return { startAt: start, endAt: end };
}

export function rescheduleEventOnHourSlot(
  day: Date,
  slotHour: number,
  payload: CalendarEventDragPayload,
): { startAt: Date; endAt: Date } {
  const oldStart = new Date(payload.startAt);
  const oldEnd = new Date(payload.endAt);
  const dur = Math.max(0, oldEnd.getTime() - oldStart.getTime());
  const start = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    slotHour,
    oldStart.getMinutes(),
    0,
    0,
  );
  const end = new Date(start.getTime() + (dur || 60 * 60 * 1000));
  return { startAt: start, endAt: end };
}

export function isDbCalendarEvent(event: {
  createdById?: string;
}): boolean {
  return Boolean(event.createdById);
}
