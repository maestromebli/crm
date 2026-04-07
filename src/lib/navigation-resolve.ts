import { NAV_SECTIONS } from "../config/navigation";

export type ResolvedNavContext = {
  section: (typeof NAV_SECTIONS)[number];
  subItem:
    | NonNullable<(typeof NAV_SECTIONS)[number]["subItems"]>[number]
    | null;
};

/**
 * Matches pathname to main nav section and exact sub-item (from NAV_SECTIONS).
 */
export function resolveNavContext(
  pathname: string,
): ResolvedNavContext | null {
  for (const section of NAV_SECTIONS) {
    if (
      pathname === section.href ||
      pathname.startsWith(`${section.href}/`)
    ) {
      const subItem =
        section.subItems?.find((s) => s.href === pathname) ?? null;
      return { section, subItem };
    }
  }
  return null;
}

export function buildModulePath(
  baseHref: string,
  slug?: string[],
): string {
  if (!slug?.length) return baseHref;
  return `${baseHref}/${slug.join("/")}`;
}

export function pageTitleFromPath(pathname: string, fallback: string): string {
  const ctx = resolveNavContext(pathname);
  if (!ctx) return fallback;
  const sub = ctx.subItem?.label ?? ctx.section.label;
  return `${sub} · ENVER CRM`;
}
