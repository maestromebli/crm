/** MIME для dataTransfer при перетягуванні події календаря. */
export const CALENDAR_EVENT_DRAG_MIME = "application/x-enver-calendar-event";

export type CalendarEventDragPayload = {
  id: string;
  startAt: string;
  endAt: string;
};

export function serializeCalendarDragPayload(
  payload: CalendarEventDragPayload,
): string {
  return JSON.stringify(payload);
}

export function parseCalendarDragPayload(
  raw: string,
): CalendarEventDragPayload | null {
  try {
    const v = JSON.parse(raw) as CalendarEventDragPayload;
    if (
      typeof v?.id === "string" &&
      typeof v?.startAt === "string" &&
      typeof v?.endAt === "string"
    ) {
      return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}
