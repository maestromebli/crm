import type { SessionUser } from "../../authz/api-guard";
import { getVisibleNavSections } from "../../navigation-visible";

/**
 * Розділи бокового меню, доступні користувачу за `permission` секції (без React-іконок).
 */
export function buildNavSnapshotForAi(user: SessionUser) {
  const sections = getVisibleNavSections({
    permissionKeys: user.permissionKeys,
    realRole: user.realRole,
    impersonatorId: user.impersonatorId,
    menuAccess: user.menuAccess,
  }).map((section) => ({
    id: section.id,
    label: section.label,
    href: section.href,
    sub_items: (section.subItems ?? []).map((subItem) => ({
      label: subItem.label,
      href: subItem.href,
      description: subItem.description ?? null,
    })),
  }));

  return {
    hint: "Використовуй ці шляхи (href) для підказок новачкам; не вигадуй інші URL.",
    sections,
  };
}
