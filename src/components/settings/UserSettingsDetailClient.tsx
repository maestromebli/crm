"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { PermissionKey, Role } from "@prisma/client";
import { CRM_ROLES, ROLE_LABELS, type CrmRole } from "../../config/user-roles";
import { ROLE_POLICY_SUMMARY_UK } from "../../lib/authz/role-access-policy";
import { hasPermission } from "../../lib/authz/permissions";
import type { MenuAccessState, NavSectionManifest } from "../../lib/navigation-access";
import { patchJson as patchJsonRequest } from "../../lib/api/patch-json";
import { SettingsCard } from "./SettingsCard";
import { Button } from "../ui/button";

type ApiUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
};

type LoadPayload = {
  user: ApiUser;
  permissionKeys: string[];
  menuAccess: MenuAccessState | null;
  navManifest: NavSectionManifest[];
  canManage: boolean;
  canAssignSuperAdmin: boolean;
};

type PatchResponse = {
  ok?: boolean;
  error?: string;
  permissionKeys?: string[];
  menuAccess?: MenuAccessState | null;
  user?: ApiUser;
};

async function parseApiJson<T>(r: Response): Promise<T> {
  const text = await r.text();
  if (!text?.trim()) {
    if (!r.ok) {
      throw new Error(`Порожня відповідь сервера (HTTP ${r.status})`);
    }
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.slice(0, 160).replace(/\s+/g, " ");
    throw new Error(
      `Некоректна відповідь сервера (HTTP ${r.status}): ${snippet}`,
    );
  }
}

function NavToggle({
  checked,
  disabled,
  onChange,
  label,
  description,
  indent,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  indent?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg py-2 hover:bg-[var(--enver-hover)]/80 ${indent ? "pl-8" : ""} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-slate-200 transition after:absolute after:left-0.5 after:top-0.5 after:block after:h-4 after:w-4 after:rounded-full after:bg-[var(--enver-card)] after:shadow after:transition after:content-[''] peer-checked:bg-emerald-600 peer-focus-visible:ring-2 peer-focus-visible:ring-slate-400 peer-disabled:opacity-50 peer-checked:after:translate-x-4"
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-[var(--enver-text)]">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[10px] text-slate-500">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function mergeMenuAccess(
  prev: MenuAccessState | null,
  sectionId: string,
  next:
    | "all"
    | string[]
    | "remove",
): MenuAccessState | null {
  const base: MenuAccessState = { ...(prev ?? {}) };
  if (next === "remove") {
    delete base[sectionId];
  } else {
    base[sectionId] = next;
  }
  return Object.keys(base).length > 0 ? base : null;
}

export function UserSettingsDetailClient({ userId }: { userId: string }) {
  const { update: updateSession } = useSession();
  const [tab, setTab] = useState<"general" | "access" | "extra">("general");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LoadPayload | null>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState<CrmRole>("SALES_MANAGER");
  const [generalBusy, setGeneralBusy] = useState(false);
  const [generalMsg, setGeneralMsg] = useState<string | null>(null);

  const [accessBusy, setAccessBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/settings/users/${userId}`);
      const j = await parseApiJson<LoadPayload & { error?: string }>(r);
      if (!r.ok) {
        setLoadError(j.error ?? `Помилка ${r.status}`);
        setData(null);
        return;
      }
      setData(j);
      setName(j.user.name?.trim() ?? "");
      setRole(j.user.role as CrmRole);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Не вдалося завантажити дані",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchJson = async (body: Record<string, unknown>) => {
    const j = await patchJsonRequest<PatchResponse>(`/api/settings/users/${userId}`, body);
    if (j.permissionKeys && j.menuAccess !== undefined && j.user) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              user: j.user!,
              permissionKeys: j.permissionKeys!,
              menuAccess: j.menuAccess ?? null,
            }
          : prev,
      );
    } else {
      await load();
    }
    await updateSession?.();
  };

  const onSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.canManage) return;
    setGeneralMsg(null);
    setGeneralBusy(true);
    try {
      await patchJson({
        name: name.trim() || null,
        role,
      });
      setGeneralMsg("Збережено.");
    } catch (err) {
      setGeneralMsg(
        err instanceof Error ? err.message : "Помилка збереження",
      );
    } finally {
      setGeneralBusy(false);
    }
  };

  const parentAllowed = (perm: string | null, keys: string[]) => {
    if (!perm) return true;
    return hasPermission(keys, perm as import("../../lib/authz/permissions").Phase1Permission);
  };

  const subChecked = (
    section: NavSectionManifest,
    subId: string,
    keys: string[],
    menuAccess: MenuAccessState | null,
  ) => {
    if (!parentAllowed(section.permission, keys)) return false;
    const rule = menuAccess?.[section.id];
    if (rule === undefined || rule === "all") return true;
    return rule.includes(subId);
  };

  const onParentToggle = async (
    section: NavSectionManifest,
    granted: boolean,
  ) => {
    if (!section.permission || !data?.canManage) return;
    setAccessBusy(true);
    try {
      const key = section.permission as PermissionKey;
      let nextMenu = data.menuAccess;
      if (granted) {
        nextMenu = mergeMenuAccess(nextMenu, section.id, "all");
      } else {
        nextMenu = mergeMenuAccess(nextMenu, section.id, "remove");
      }
      await patchJson({
        permissionKey: key,
        permissionGranted: granted,
        menuAccess: nextMenu,
      });
    } finally {
      setAccessBusy(false);
    }
  };

  const onSubToggle = async (
    section: NavSectionManifest,
    subId: string,
    on: boolean,
  ) => {
    if (!data?.canManage || !section.permission) return;
    const subIds = section.subItems.map((s) => s.id);
    setAccessBusy(true);
    try {
      const keys = data.permissionKeys;
      if (!parentAllowed(section.permission, keys)) return;

      const rule = data.menuAccess?.[section.id];
      let selected: Set<string>;
      if (rule === undefined || rule === "all") {
        selected = new Set(subIds);
      } else {
        selected = new Set(rule);
      }
      if (on) selected.add(subId);
      else selected.delete(subId);

      if (selected.size === 0) {
        await patchJson({
          permissionKey: section.permission as PermissionKey,
          permissionGranted: false,
          menuAccess: mergeMenuAccess(data.menuAccess, section.id, "remove"),
        });
        return;
      }

      if (selected.size === subIds.length) {
        await patchJson({
          menuAccess: mergeMenuAccess(data.menuAccess, section.id, "all"),
        });
        return;
      }

      await patchJson({
        menuAccess: mergeMenuAccess(
          data.menuAccess,
          section.id,
          [...selected],
        ),
      });
    } finally {
      setAccessBusy(false);
    }
  };

  if (loading) {
    return <p className="text-xs text-slate-500">Завантаження…</p>;
  }
  if (loadError || !data) {
    return (
      <p className="text-xs text-red-600">{loadError ?? "Немає даних"}</p>
    );
  }

  const d = data;

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
        <Link href="/settings/users" className="hover:text-slate-800 hover:underline">
          Користувачі
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-slate-800">
          {d.user.name?.trim() || d.user.email}
        </span>
        <span aria-hidden>/</span>
        <Link
          href={`/settings/communications/users?userId=${d.user.id}`}
          className="font-medium text-emerald-700 hover:underline"
        >
          Канали звʼязку
        </Link>
      </nav>

      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            ["general", "Загальне"],
            ["access", "Доступ"],
            ["extra", "Додатково"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`border-b-2 px-3 py-2 text-xs font-medium transition ${
              tab === id
                ? "border-slate-900 text-[var(--enver-text)]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "general" ? (
        <SettingsCard
          title="Загальна інформація"
          description="Імʼя та роль облікового запису."
        >
          <form className="space-y-3" onSubmit={(e) => void onSaveGeneral(e)}>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-600" htmlFor="ud-name">
                Імʼя
              </label>
              <input
                id="ud-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!d.canManage}
                className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1.5 text-xs outline-none focus:border-slate-900 disabled:bg-slate-50"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-slate-600">Ел. пошта</p>
              <p className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs text-slate-800">
                {d.user.email}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-600" htmlFor="ud-role">
                Роль
              </label>
              <select
                id="ud-role"
                value={role}
                onChange={(e) => setRole(e.target.value as CrmRole)}
                disabled={!d.canManage}
                className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1.5 text-xs outline-none focus:border-slate-900 disabled:bg-slate-50"
              >
                {CRM_ROLES.filter(
                  (r) => r !== "SUPER_ADMIN" || d.canAssignSuperAdmin,
                ).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              {ROLE_POLICY_SUMMARY_UK[role as Role] ? (
                <p className="text-[10px] leading-relaxed text-slate-500">
                  {ROLE_POLICY_SUMMARY_UK[role as Role]}
                </p>
              ) : null}
            </div>
            {d.canManage ? (
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={generalBusy}
                >
                  {generalBusy ? "Збереження…" : "Зберегти"}
                </Button>
                {generalMsg ? (
                  <span className="text-[11px] text-slate-600">
                    {generalMsg}
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                Лише перегляд. Потрібне право USERS_MANAGE для змін.
              </p>
            )}
          </form>
        </SettingsCard>
      ) : null}

      {tab === "access" ? (
        <SettingsCard
          title="Доступ до пунктів меню"
          description="Список формується автоматично з конфігурації навігації CRM. Нові розділи зʼявляться тут після додавання в коді (NAV_SECTIONS)."
        >
          {accessBusy ? (
            <p className="mb-2 text-[11px] text-slate-500">Оновлення…</p>
          ) : null}
          {!d.canManage ? (
            <p className="text-[11px] text-slate-500">
              Перегляд поточних прав. Редагування — з правом USERS_MANAGE.
            </p>
          ) : null}
          <div className="divide-y divide-slate-100">
            {d.navManifest.map((section) => {
              const pOn = parentAllowed(section.permission, d.permissionKeys);
              return (
                <div key={section.id} className="py-3 first:pt-0">
                  {section.permission ? (
                    <NavToggle
                      checked={pOn}
                      disabled={!d.canManage || accessBusy}
                      onChange={(v) => void onParentToggle(section, v)}
                      label={section.label}
                      description={`Модуль: ${section.permission}`}
                    />
                  ) : (
                    <p className="text-xs font-medium text-[var(--enver-text)]">
                      {section.label}
                    </p>
                  )}
                  {section.subItems.length > 0 ? (
                    <div className="mt-1 border-l border-slate-100 pl-2">
                      <p className="mb-1 pl-6 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        Підпункти меню
                      </p>
                      {section.subItems.map((sub) => (
                        <NavToggle
                          key={sub.id}
                          indent
                          checked={subChecked(
                            section,
                            sub.id,
                            d.permissionKeys,
                            d.menuAccess,
                          )}
                          disabled={
                            !d.canManage ||
                            accessBusy ||
                            !pOn ||
                            !section.permission
                          }
                          onChange={(v) =>
                            void onSubToggle(section, sub.id, v)
                          }
                          label={sub.label}
                          description={sub.href}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </SettingsCard>
      ) : null}

      {tab === "extra" ? (
        <SettingsCard
          title="Додатково"
          description="Розширені параметри облікового запису."
        >
          <p className="text-[11px] text-slate-600">
            Тут можна пізніше додати прапорці (на кшталт «AI-помічник», ліміти
            сховища тощо). Зараз уся логіка доступу до модулів — у вкладці
            «Доступ».
          </p>
        </SettingsCard>
      ) : null}
    </div>
  );
}
