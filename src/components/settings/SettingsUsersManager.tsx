"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SettingsCard } from "./SettingsCard";
import { Button } from "../ui/button";
import { CRM_ROLES, ROLE_LABELS, type CrmRole } from "../../config/user-roles";

type ApiUser = {
  id: string;
  email: string;
  name: string | null;
  role: CrmRole;
};

export function SettingsUsersManager() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [canAssignSuperAdmin, setCanAssignSuperAdmin] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<CrmRole>("SALES_MANAGER");
  const [password, setPassword] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetErr, setResetErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/settings/users");
      const j = (await r.json()) as {
        users?: ApiUser[];
        canManage?: boolean;
        canAssignSuperAdmin?: boolean;
        error?: string;
      };
      if (!r.ok) {
        setLoadError(j.error ?? `Помилка ${r.status}`);
        setUsers([]);
        return;
      }
      setUsers(j.users ?? []);
      setCanManage(Boolean(j.canManage));
      setCanAssignSuperAdmin(Boolean(j.canAssignSuperAdmin));
    } catch {
      setLoadError("Не вдалося завантажити список");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const genLocal = () => {
    const chars =
      "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const a = new Uint8Array(14);
    crypto.getRandomValues(a);
    let s = "";
    for (let i = 0; i < 14; i++) s += chars[a[i]! % chars.length];
    return s;
  };

  const onGenerateCreate = () => {
    setPassword(genLocal());
  };

  const onGenerateReset = () => {
    setResetPassword(genLocal());
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErr(null);
    setCreateMsg(null);
    setCreateBusy(true);
    try {
      const r = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || null,
          role,
          password: password.trim() || undefined,
        }),
      });
      const j = (await r.json()) as {
        user?: ApiUser;
        generatedPassword?: string;
        error?: string;
      };
      if (!r.ok) {
        setCreateErr(j.error ?? "Не вдалося створити");
        return;
      }
      setEmail("");
      setName("");
      setPassword("");
      setRole("SALES_MANAGER");
      if (j.generatedPassword) {
        setCreateMsg(
          `Користувача створено. Згенерований пароль (збережіть і передайте користувачу): ${j.generatedPassword}`,
        );
      } else {
        setCreateMsg("Користувача створено.");
      }
      await load();
    } catch {
      setCreateErr("Мережева помилка");
    } finally {
      setCreateBusy(false);
    }
  };

  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId) return;
    setResetErr(null);
    setResetMsg(null);
    setResetBusy(true);
    try {
      const trimmed = resetPassword.trim();
      const r = await fetch(`/api/settings/users/${resetUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          trimmed
            ? { password: trimmed }
            : { generatePassword: true },
        ),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        generatedPassword?: string;
        error?: string;
      };
      if (!r.ok) {
        setResetErr(j.error ?? "Не вдалося змінити пароль");
        return;
      }
      setResetPassword("");
      setResetUserId(null);
      if (j.generatedPassword) {
        setResetMsg(
          `Новий пароль: ${j.generatedPassword} (показано один раз — збережіть).`,
        );
      } else {
        setResetMsg("Пароль оновлено.");
      }
    } catch {
      setResetErr("Мережева помилка");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <>
      <SettingsCard
        title="Користувачі"
        description="Список облікових записів CRM."
      >
        {loading ? (
          <p className="text-xs text-slate-500">Завантаження…</p>
        ) : loadError ? (
          <p className="text-xs text-red-600">{loadError}</p>
        ) : users.length === 0 ? (
          <p className="text-xs text-slate-500">Користувачів немає.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Імʼя · email</span>
              <span>Роль</span>
            </div>
            <ul className="space-y-2">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="rounded-xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2 text-[11px] text-slate-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--enver-text)]">
                        {u.name?.trim() || "—"}
                      </p>
                      <p className="text-[10px] text-slate-500">{u.email}</p>
                      <Link
                        href={`/settings/users/${u.id}`}
                        className="mt-1 inline-block text-[10px] font-medium text-sky-700 underline-offset-2 hover:underline"
                      >
                        Профіль і доступ
                      </Link>
                      <Link
                        href={`/settings/communications/users?userId=${u.id}`}
                        className="mt-1 ml-3 inline-block text-[10px] font-medium text-emerald-700 underline-offset-2 hover:underline"
                      >
                        Канали звʼязку
                      </Link>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-slate-50">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </div>
                  {canManage ? (
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      {resetUserId === u.id ? (
                        <form
                          className="space-y-2"
                          onSubmit={(ev) => void onResetPassword(ev)}
                        >
                          <p className="text-[10px] text-slate-600">
                            Новий пароль (мін. 8 символів) або залиште порожнім і
                            натисніть «Застосувати» — згенеруємо автоматично.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="text"
                              autoComplete="new-password"
                              value={resetPassword}
                              onChange={(ev) => setResetPassword(ev.target.value)}
                              className="min-w-[180px] flex-1 rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
                              placeholder="Новий пароль"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={onGenerateReset}
                            >
                              Згенерувати
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="submit"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={resetBusy}
                            >
                              {resetBusy ? "Збереження…" : "Застосувати"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => {
                                setResetUserId(null);
                                setResetPassword("");
                                setResetErr(null);
                              }}
                            >
                              Скасувати
                            </Button>
                          </div>
                          {resetErr ? (
                            <p className="text-[10px] text-red-600">{resetErr}</p>
                          ) : null}
                        </form>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            setResetUserId(u.id);
                            setResetErr(null);
                            setResetMsg(null);
                            setResetPassword("");
                          }}
                        >
                          Змінити пароль
                        </Button>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
        {resetMsg && !resetUserId ? (
          <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-900">
            {resetMsg}
          </p>
        ) : null}
      </SettingsCard>

      {canManage ? (
        <SettingsCard
          title="Додати користувача"
          description="Email, імʼя, роль. Пароль — вручну або згенеруйте; якщо залишити порожнім, сервер згенерує сам."
        >
          <form className="space-y-3" onSubmit={(ev) => void onCreate(ev)}>
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-600" htmlFor="su-email">
                Email
              </label>
              <input
                id="su-email"
                type="email"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-600" htmlFor="su-name">
                Імʼя (необовʼязково)
              </label>
              <input
                id="su-name"
                type="text"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-600" htmlFor="su-role">
                Роль
              </label>
              <select
                id="su-role"
                value={role}
                onChange={(ev) => setRole(ev.target.value as CrmRole)}
                className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
              >
                {CRM_ROLES.filter(
                  (r) => r !== "SUPER_ADMIN" || canAssignSuperAdmin,
                ).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label
                className="text-[11px] text-slate-600"
                htmlFor="su-password"
              >
                Пароль (необовʼязково, мін. 8 символів)
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="su-password"
                  type="text"
                  autoComplete="new-password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  className="min-w-[200px] flex-1 rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
                  placeholder="Порожньо = згенерує сервер"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={onGenerateCreate}
                >
                  Згенерувати
                </Button>
              </div>
            </div>
            {createErr ? (
              <p className="text-[11px] text-red-600">{createErr}</p>
            ) : null}
            {createMsg ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950">
                {createMsg}
              </p>
            ) : null}
            <Button
              type="submit"
              size="sm"
              className="h-9 text-xs"
              disabled={createBusy}
            >
              {createBusy ? "Створення…" : "Створити користувача"}
            </Button>
          </form>
        </SettingsCard>
      ) : !loading && !loadError ? (
        <SettingsCard
          title="Додати користувача"
          description="Потрібне право «Керування користувачами» (USERS_MANAGE)."
        >
          <p className="text-xs text-slate-500">
            Ви можете переглядати список, але не створювати записи.
          </p>
        </SettingsCard>
      ) : null}
    </>
  );
}
