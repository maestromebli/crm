import { NAV_SECTIONS } from "../../../config/navigation";
import type { SessionUser } from "../../authz/api-guard";
import { hasEffectivePermission } from "../../authz/permissions";

/**
 * Розділи бокового меню, доступні користувачу за `permission` секції (без React-іконок).
 */
export function buildNavSnapshotForAi(user: SessionUser) {
  const ctx = {
    realRole: user.realRole,
    impersonatorId: user.impersonatorId,
  };

  const sections = NAV_SECTIONS.filter((s) => {
    if (!s.permission) return true;
    return hasEffectivePermission(user.permissionKeys, s.permission, ctx);
  }).map((s) => ({
    id: s.id,
    label: s.label,
    href: s.href,
    sub_items: (s.subItems ?? []).map((si) => ({
      label: si.label,
      href: si.href,
      description: si.description ?? null,
    })),
  }));

  return {
    hint: "Використовуй ці шляхи (href) для підказок новачкам; не вигадуй інші URL.",
    sections,
  };
}
