/**
 * Збереження налаштувань таблиці моніторингу позицій (окремі ключі для огляду та hub).
 */

export type SortMode = "crm" | "days" | "remaining" | "deal" | "fulfill";

export type QuickFilter = "all" | "overdue" | "soon" | "overrun" | "saving" | "no_deadline";

export type StoredMonitorPrefs = {
  q: string;
  sortMode: SortMode;
  sortDir: 1 | -1;
  quickFilter: QuickFilter;
};

const DEFAULTS: StoredMonitorPrefs = {
  q: "",
  sortMode: "crm",
  sortDir: 1,
  quickFilter: "all",
};

function key(scope: string): string {
  return scope === "hub" ? "crm-proc-monitor-table-v1-hub" : "crm-proc-monitor-table-v1";
}

export function readMonitorPrefs(scope: string): StoredMonitorPrefs {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(key(scope));
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<StoredMonitorPrefs>;
    return {
      q: typeof p.q === "string" ? p.q : DEFAULTS.q,
      sortMode: isSortMode(p.sortMode) ? p.sortMode : DEFAULTS.sortMode,
      sortDir: p.sortDir === -1 ? -1 : 1,
      quickFilter: isQuickFilter(p.quickFilter) ? p.quickFilter : DEFAULTS.quickFilter,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeMonitorPrefs(scope: string, prefs: StoredMonitorPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(scope), JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

function isSortMode(v: unknown): v is SortMode {
  return v === "crm" || v === "days" || v === "remaining" || v === "deal" || v === "fulfill";
}

function isQuickFilter(v: unknown): v is QuickFilter {
  return (
    v === "all" ||
    v === "overdue" ||
    v === "soon" ||
    v === "overrun" ||
    v === "saving" ||
    v === "no_deadline"
  );
}

export const HUB_SEGMENT_KEY = "crm-proc-hub-monitor-segment-v1";

export type HubSegment = "all" | "deadline" | "finance";

export function readHubSegment(): HubSegment {
  if (typeof window === "undefined") return "all";
  try {
    const v = localStorage.getItem(HUB_SEGMENT_KEY);
    if (v === "all" || v === "deadline" || v === "finance") return v;
  } catch {
    /* ignore */
  }
  return "all";
}

export function writeHubSegment(segment: HubSegment): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HUB_SEGMENT_KEY, segment);
  } catch {
    /* ignore */
  }
}
