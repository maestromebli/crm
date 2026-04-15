"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CommunicationsSettingsClient } from "../CommunicationsSettingsClient";

type ApiUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

export function UsersCommunicationsManager({
  initialUserId,
}: {
  initialUserId?: string;
}) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("/api/settings/users");
        const j = (await r.json()) as { users?: ApiUser[]; error?: string };
        if (!r.ok) throw new Error(j.error ?? "Помилка завантаження");
        if (cancelled) return;
        const list = j.users ?? [];
        setUsers(list);
        setSelectedUserId((prev) => prev || initialUserId || list[0]?.id || "");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Помилка завантаження");
          setUsers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialUserId]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  if (loading) return <p className="text-xs text-slate-500">Завантаження…</p>;
  if (error) {
    return (
      <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
        {error}
      </p>
    );
  }
  if (!users.length) {
    return <p className="text-xs text-slate-500">Немає користувачів у видимості.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-3">
        <label className="mb-1 block text-[11px] text-slate-600">
          Співробітник
        </label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1.5 text-xs outline-none focus:border-slate-900"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {(u.name?.trim() || "—") + " · " + u.email}
            </option>
          ))}
        </select>
        {selectedUser ? (
          <p className="mt-1 text-[10px] text-slate-500">
            Роль: {selectedUser.role}
          </p>
        ) : null}
      </div>

      {selectedUserId ? (
        <CommunicationsSettingsClient
          apiBasePath={`/api/settings/communications/users/${selectedUserId}`}
          managerCardTitle="Контакти співробітника"
          managerCardDescription="Номер телефону та відображуване імʼя саме цього співробітника."
          saveHint="Зміни застосовуються тільки до вибраного співробітника."
          hiddenChannels={["instagram", "facebook"]}
          footerNote={
            <>
              Instagram/Facebook Direct підключаються як спільна сторінка компанії в
              глобальних налаштуваннях:{" "}
              <Link
                href="/settings/communications"
                className="underline underline-offset-2"
              >
                /settings/communications
              </Link>
              .
            </>
          }
        />
      ) : null}
    </div>
  );
}
