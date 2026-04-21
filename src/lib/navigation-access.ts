import { NAV_SECTIONS } from "../config/navigation";
import type { Phase1Permission } from "./authz/permissions";
import {
  hasEffectiveAnyPermission,
  hasEffectivePermission,
} from "./authz/permissions";

export type NavSubManifest = {
  id: string;
  label: string;
  href: string;
  permission: Phase1Permission | null;
  anyPermissions: Phase1Permission[];
};

export type NavSectionManifest = {
  id: string;
  label: string;
  href: string;
  permission: Phase1Permission | null;
  subItems: NavSubManifest[];
};

/** Значення з БД / сесії: для секції — усі підпункти або явний список id підпунктів. */
export type MenuAccessState = Record<
  string,
  "all" | string[]
>;

export function buildNavManifest(): NavSectionManifest[] {
  return NAV_SECTIONS.map((s) => ({
    id: s.id,
    label: s.label,
    href: s.href,
    permission: s.permission ?? null,
    subItems: (s.subItems ?? []).map((sub) => ({
      id: sub.id,
      label: sub.label,
      href: sub.href,
      permission: sub.permission ?? null,
      anyPermissions: sub.anyPermissions ?? [],
    })),
  }));
}

/**
 * Точна відповідність pathname → (sectionId, subItemId).
 * Якщо href спільний у секції та підпункта, перемагає підпункт (останній запис у мапі).
 */
export function buildExactNavPathIndex(): Map<
  string,
  { sectionId: string; subId: string }
> {
  const m = new Map<string, { sectionId: string; subId: string }>();
  for (const s of NAV_SECTIONS) {
    m.set(s.href, { sectionId: s.id, subId: "_section" });
    for (const sub of s.subItems ?? []) {
      m.set(sub.href, { sectionId: s.id, subId: sub.id });
    }
  }
  return m;
}

let pathIndexCache: Map<
  string,
  { sectionId: string; subId: string }
> | null = null;

export function getExactNavPathIndex(): Map<
  string,
  { sectionId: string; subId: string }
> {
  if (!pathIndexCache) pathIndexCache = buildExactNavPathIndex();
  return pathIndexCache;
}

export function sanitizeMenuAccess(raw: unknown): MenuAccessState | null {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;

  const manifest = buildNavManifest();
  const sectionById = new Map(manifest.map((sec) => [sec.id, sec]));
  const out: MenuAccessState = {};

  for (const [sectionId, val] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    const sec = sectionById.get(sectionId);
    if (!sec) continue;

    if (val === "all" || val === true) {
      out[sectionId] = "all";
      continue;
    }
    if (!Array.isArray(val)) continue;

    const allowedIds = new Set(sec.subItems.map((x) => x.id));
    const filtered = val.filter(
      (x): x is string => typeof x === "string" && allowedIds.has(x),
    );
    if (filtered.length === 0) continue;
    out[sectionId] = filtered;
  }

  return Object.keys(out).length > 0 ? out : null;
}

export function isExactNavPathAllowed(
  pathname: string,
  menuAccess: MenuAccessState | null | undefined,
): boolean {
  // Якщо явно не налаштовано menuAccess — використовуємо інші механізми доступу (permissions/page guards).
  if (!menuAccess || Object.keys(menuAccess).length === 0) {
    return true;
  }

  const target = getExactNavPathIndex().get(pathname);
  if (!target) return true;

  const rule = menuAccess[target.sectionId];
  // За наявності menuAccess це strict allowlist: не вказано секцію -> заборонено.
  if (rule === undefined) return false;

  if (rule === "all") return true;

  if (target.subId === "_section") {
    return rule.includes("_section");
  }

  return rule.includes(target.subId);
}

export function filterNavSubItemsForUser(
  sectionId: string,
  subItems: readonly {
    id: string;
    label: string;
    href: string;
    permission?: Phase1Permission;
    anyPermissions?: readonly Phase1Permission[];
  }[],
  menuAccess: MenuAccessState | null | undefined,
  permissionContext?: {
    permissionKeys: string[] | undefined;
    realRole?: string;
    impersonatorId?: string | null;
  },
): { id: string; label: string; href: string }[] {
  const byPermissions = subItems.filter((sub) => {
    if (!permissionContext) return true;
    if (
      sub.permission &&
      !hasEffectivePermission(permissionContext.permissionKeys, sub.permission, {
        realRole: permissionContext.realRole,
        impersonatorId: permissionContext.impersonatorId ?? undefined,
      })
    ) {
      return false;
    }
    if (
      sub.anyPermissions?.length &&
      !hasEffectiveAnyPermission(
        permissionContext.permissionKeys,
        [...sub.anyPermissions],
        {
          realRole: permissionContext.realRole,
          impersonatorId: permissionContext.impersonatorId ?? undefined,
        },
      )
    ) {
      return false;
    }
    return true;
  });

  if (!menuAccess) return [...byPermissions];
  const rule = menuAccess[sectionId];
  // За наявності menuAccess це strict allowlist: не вказано секцію -> не показуємо.
  if (rule === undefined) return [];
  if (rule === "all") return [...byPermissions];
  const allow = new Set(rule);
  return byPermissions.filter((s) => allow.has(s.id));
}
