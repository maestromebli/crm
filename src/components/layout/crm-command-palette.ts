/**
 * Спільна логіка command palette: скоринг, недавні переходи, популярні маршрути.
 * Винесено з UI, щоб тримати AppHeader легким і тестованим.
 */

export const CRM_NAV_RECENT_KEY = "crm.commandPalette.recent.v1";

export type RecentNavEntry = {
  id: string;
  href: string;
  label: string;
  ts: number;
};

export function readRecentNav(max: number): RecentNavEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CRM_NAV_RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is RecentNavEntry =>
          Boolean(row && typeof row === "object" && "href" in row && typeof (row as RecentNavEntry).href === "string"),
      )
      .sort((a, b) => b.ts - a.ts)
      .slice(0, max);
  } catch {
    return [];
  }
}

export function pushRecentNav(entry: Omit<RecentNavEntry, "ts">, max: number) {
  if (typeof window === "undefined") return;
  try {
    const prev = readRecentNav(50);
    const next: RecentNavEntry[] = [
      { ...entry, ts: Date.now() },
      ...prev.filter((r) => r.href !== entry.href),
    ].slice(0, max);
    window.localStorage.setItem(CRM_NAV_RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

/** Топові екрани, якщо немає історії (або як доповнення). */
export const POPULAR_NAV_PRESETS: Array<{ id: string; label: string; href: string }> = [
  { id: "popular:dashboard", label: "Дашборд CRM", href: "/crm/dashboard" },
  { id: "popular:leads", label: "Ліди", href: "/leads" },
  { id: "popular:deals", label: "Угоди", href: "/deals" },
  { id: "popular:finance", label: "Фінанси", href: "/crm/finance" },
  { id: "popular:production", label: "Виробництво", href: "/crm/production" },
  { id: "popular:tasks", label: "Задачі", href: "/tasks" },
];

export function scoreNavItem(
  item: {
    label: string;
    href: string;
    scope: "Розділ" | "Підрозділ";
    searchableText: string;
  },
  rawQuery: string,
): number {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return 0;
  const terms = q.split(/\s+/).filter(Boolean);
  let score = 0;
  const label = item.label.toLowerCase();
  const href = item.href.toLowerCase();
  const hay = item.searchableText;

  for (const term of terms) {
    if (!hay.includes(term)) return -1;
    if (label.startsWith(term)) score += 120;
    else if (label.includes(term)) score += 70;
    else if (href.includes(term)) score += 45;
    else score += 25;
  }

  if (item.scope === "Розділ") score += 8;
  const pathDepth = (item.href.match(/\//g) ?? []).length;
  score += Math.max(0, 12 - pathDepth * 2);
  return score;
}

export function pickBestHighlightQuery(label: string, query: string): string {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return query.trim();
  const lower = label.toLowerCase();
  let best = terms[0];
  let bestIdx = lower.length;
  for (const term of terms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx !== -1 && idx < bestIdx) {
      bestIdx = idx;
      best = term;
    }
  }
  return best;
}
