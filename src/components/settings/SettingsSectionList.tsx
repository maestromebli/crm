"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { SETTINGS_ITEMS } from "../../config/settings";
import { cn } from "../../lib/utils";

type SettingsSectionListProps = {
  currentPath: string;
};

export function SettingsSectionList({
  currentPath,
}: SettingsSectionListProps) {
  const { data } = useSession();
  const role = data?.user?.realRole ?? data?.user?.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = isSuperAdmin || role === "ADMIN" || role === "DIRECTOR";

  const visibleItems = SETTINGS_ITEMS.filter((item) => {
    if (item.access === "super-admin") return isSuperAdmin;
    return isAdmin;
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

