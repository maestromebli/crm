import type { CalendarEvent } from "./types";

/** Екранування тексту для iCalendar (RFC 5545). */
export function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formatIcsUtc(d: Date): string {
  return (
    d.getUTCFullYear().toString().padStart(4, "0") +
    (d.getUTCMonth() + 1).toString().padStart(2, "0") +
    d.getUTCDate().toString().padStart(2, "0") +
    "T" +
    d.getUTCHours().toString().padStart(2, "0") +
    d.getUTCMinutes().toString().padStart(2, "0") +
    d.getUTCSeconds().toString().padStart(2, "0") +
    "Z"
  );
}

function foldIcsLine(line: string): string {
  const max = 75;
  if (line.length <= max) return line;
  let out = "";
  let rest = line;
  while (rest.length > max) {
    out += rest.slice(0, max) + "\r\n ";
    rest = rest.slice(max);
  }
  return out + rest;
}

/**
 * Тіло .ics для імпорту в Google / Apple / Outlook.
 * Час у UTC; для більшості месенджерів і телефонів достатньо.
 */
export function buildCalendarIcs(event: CalendarEvent): string {
  const uid = `${event.id.replace(/[^a-zA-Z0-9@-]/g, "")}@enver-crm`;
  const dtStamp = formatIcsUtc(new Date());
  const dtStart = formatIcsUtc(new Date(event.startAt));
  const dtEnd = formatIcsUtc(new Date(event.endAt));
  const summary = icsEscape(event.title);
  const loc = event.location ? icsEscape(event.location) : "";
  const descParts = [
    event.notes?.trim(),
    event.assigneeName ? `Відповідальний: ${event.assigneeName}` : "",
    event.linkedEntityLabel
      ? `Звʼязок: ${event.linkedEntityLabel}`
      : "",
  ].filter(Boolean);
  const description = icsEscape(descParts.join("\\n"));

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ENVER CRM//UK//NONSGML v1.0//",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    foldIcsLine(`SUMMARY:${summary}`),
  ];
  if (loc) lines.push(foldIcsLine(`LOCATION:${loc}`));
  if (description) lines.push(foldIcsLine(`DESCRIPTION:${description}`));
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n") + "\r\n";
}

export function suggestedIcsFileName(event: CalendarEvent): string {
  const slug = event.title
    .slice(0, 40)
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `podiya-${slug || "enver"}.ics`;
}
