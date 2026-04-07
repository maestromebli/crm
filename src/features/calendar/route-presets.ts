import type { CalendarFilterState } from "./types";

export type CalendarRoutePreset =
  | "my"
  | "team"
  | "measurements"
  | "meetings"
  | "installations"
  | "production"
  | "agenda";

const SLUG_TO_PRESET: Record<string, CalendarRoutePreset> = {
  team: "team",
  measurements: "measurements",
  meetings: "meetings",
  installations: "installations",
  production: "production",
  agenda: "agenda",
};

export function presetFromCalendarSlug(
  slug?: string[],
): CalendarRoutePreset {
  const key = slug?.[0];
  if (!key) return "my";
  return SLUG_TO_PRESET[key] ?? "my";
}

export function initialFiltersForCalendarPreset(
  preset: CalendarRoutePreset,
): CalendarFilterState {
  const base: CalendarFilterState = {
    view: "week",
    onlyMine: false,
    onlyCritical: false,
    onlyOverdue: false,
    types: null,
    statuses: null,
  };

  switch (preset) {
    case "my":
      return { ...base, onlyMine: true };
    case "team":
      return { ...base, onlyMine: false };
    case "measurements":
      return { ...base, types: ["measurement"] };
    case "meetings":
      return { ...base, types: ["meeting"] };
    case "installations":
      return { ...base, types: ["installation"] };
    case "production":
      return { ...base, types: ["production"] };
    case "agenda":
      return { ...base, view: "day", onlyMine: false };
    default:
      return base;
  }
}
