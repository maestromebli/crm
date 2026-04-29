"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { SETTINGS_ITEMS } from "../../config/settings";
import { hasEffectivePermission, P } from "../../lib/authz/permissions";
import { cn } from "../../lib/utils";

type SettingsSectionListProps = {
  currentPath: string;
};

export function SettingsSectionList({
  currentPath,
}: SettingsSectionListProps) {
  const { data } = useSession();
  const role = data?.user?.realRole;
  const impersonatorId = data?.user?.impersonatorId;
  const permissionKeys = data?.user?.permissionKeys ?? [];

  const canViewSettings = hasEffectivePermission(
    permissionKeys,
    P.SETTINGS_VIEW,
    { realRole: role, impersonatorId },
  );

  const visibleItems = SETTINGS_ITEMS.filter((item) => {
    if (!canViewSettings) return false;
    if (item.path === "/settings/users") {
      return hasEffectivePermission(permissionKeys, P.USERS_VIEW, {
        realRole: role,
        impersonatorId,
      });
    }
    if (item.path === "/settings/permissions" || item.path === "/settings/integrations") {
      return hasEffectivePermission(permissionKeys, P.ROLES_MANAGE, {
        realRole: role,
        impersonatorId,
      });
    }
    if (item.path === "/settings/access-hierarchy") {
      return hasEffectivePermission(permissionKeys, P.USERS_MANAGE, {
        realRole: role,
        impersonatorId,
      });
    }
    if (item.path === "/settings/communications/users") {
      return hasEffectivePermission(permissionKeys, P.USERS_VIEW, {
        realRole: role,
        impersonatorId,
      });
    }
    if (item.path === "/settings/ai/admin") {
      return hasEffectivePermission(permissionKeys, P.AI_ANALYTICS, {
        realRole: role,
        impersonatorId,
      });
    }
    return true;
  });

  const sections = visibleItems.reduce<
    Record<string, typeof SETTINGS_ITEMS>
  >((acc, item) => {
    acc[item.section] = acc[item.section] || [];
    acc[item.section].push(item);
    return acc;
  }, {});

  return (
    <aside className="w-64 border-r border-slate-200 bg-[var(--enver-bg)] px-3 py-3 text-xs">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-orange-600">
        Налаштування
      </p>
      <div className="space-y-3">
        {Object.entries(sections).map(([section, items]) => (
          <div key={section} className="space-y-1">
            <p className="text-[11px] font-medium text-slate-500">
              {section}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = currentPath === item.path;
                return (
                  <Link
                    key={item.id}
                    href={item.path}
                    className={cn(
                      "flex items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-slate-600 hover:bg-[var(--enver-card)] hover:text-[var(--enver-text)]",
                      active &&
                        "border-orange-200 bg-[var(--enver-card)] font-medium text-[var(--enver-text)] shadow-sm",
                    )}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

