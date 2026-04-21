import { NAV_SECTIONS, type NavSection } from "../config/navigation";
import {
  hasEffectiveAnyPermission,
  hasEffectivePermission,
  P,
} from "./authz/permissions";
import {
  filterNavSubItemsForUser,
  type MenuAccessState,
} from "./navigation-access";

type NavVisibilityContext = {
  permissionKeys: string[] | undefined;
  realRole?: string;
  impersonatorId?: string | null;
  menuAccess?: MenuAccessState | null;
};

const MANAGER_VISIBLE_SECTIONS = new Set([
  "dashboard",
  "leads",
  "contacts",
  "deals",
  "calendar",
  "inbox",
  "tasks",
  "files",
  "reports",
]);

function canSeeSection(
  section: NavSection,
  ctx: Omit<NavVisibilityContext, "menuAccess">,
): boolean {
  if (
    ctx.realRole === "MANAGER" ||
    ctx.realRole === "HEAD_MANAGER"
  ) {
    if (!MANAGER_VISIBLE_SECTIONS.has(section.id)) return false;
  }

  const permissionCtx = {
    realRole: ctx.realRole,
    impersonatorId: ctx.impersonatorId ?? undefined,
  };

  if (section.id === "finance") {
    return hasEffectiveAnyPermission(
      ctx.permissionKeys,
      [P.REPORTS_VIEW, P.MARGIN_VIEW, P.COST_VIEW, P.PAYMENTS_VIEW],
      permissionCtx,
    );
  }

  if (section.id === "production") {
    return hasEffectiveAnyPermission(
      ctx.permissionKeys,
      [
        P.PRODUCTION_LAUNCH,
        P.PRODUCTION_ORDERS_VIEW,
        P.PRODUCTION_ORDERS_MANAGE,
        P.DEALS_VIEW,
      ],
      permissionCtx,
    );
  }

  if (section.id === "procurement") {
    return hasEffectiveAnyPermission(
      ctx.permissionKeys,
      [P.COST_VIEW, P.MARGIN_VIEW, P.PAYMENTS_VIEW, P.REPORTS_VIEW],
      permissionCtx,
    );
  }

  if (section.id === "handoff") {
    return hasEffectiveAnyPermission(
      ctx.permissionKeys,
      [P.HANDOFF_SUBMIT, P.HANDOFF_ACCEPT],
      permissionCtx,
    );
  }

  if (!section.permission) return true;
  return hasEffectivePermission(
    ctx.permissionKeys,
    section.permission,
    permissionCtx,
  );
}

export function getVisibleNavSections(
  ctx: NavVisibilityContext,
): NavSection[] {
  const out: NavSection[] = [];
  for (const section of NAV_SECTIONS) {
    if (
      !canSeeSection(section, {
        permissionKeys: ctx.permissionKeys,
        realRole: ctx.realRole,
        impersonatorId: ctx.impersonatorId,
      })
    ) {
      continue;
    }

    if (!section.subItems?.length) {
      out.push(section);
      continue;
    }

    const subItems = filterNavSubItemsForUser(
      section.id,
      section.subItems,
      ctx.menuAccess,
      {
        permissionKeys: ctx.permissionKeys,
        realRole: ctx.realRole,
        impersonatorId: ctx.impersonatorId,
      },
    );
    if (subItems.length === 0) continue;
    out.push({ ...section, subItems });
  }
  return out;
}
