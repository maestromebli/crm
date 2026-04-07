"use client";

import { useEffect, useMemo, useState } from "react";
import { patchJson } from "@/lib/api/patch-json";

type Head = { id: string; name: string | null; email: string };
type Manager = { id: string; name: string | null; email: string; role: string };

type ApiPayload = {
  headManagers: Head[];
  managers: Manager[];
  assignments: Record<string, string[]>;
};

export function AccessHierarchyManager() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [selectedHead, setSelectedHead] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setError(null);
      try {
        const r = await fetch("/api/settings/access-hierarchy");
        const j = (await r.json()) as ApiPayload & { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Помилка завантаження");
        if (cancelled) return;
        setData(j);
        const first = j.headManagers[0]?.id ?? "";
        setSelectedHead(first);
        setSelectedMembers(j.assignments[first] ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Помилка");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    setSelectedMembers(data.assignments[selectedHead] ?? []);
  }, [selectedHead, data]);

  const head = useMemo(
    () => data?.headManagers.find((h) => h.id === selectedHead) ?? null,
    [data, selectedHead],
  );

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const save = async () => {
    if (!selectedHead) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      await patchJson("/api/settings/access-hierarchy", {
        headManagerId: selectedHead,
        memberIds: selectedMembers,
      });
      setOk("Ієрархію збережено.");
      setData((prev) =>
        prev
          ? {
              ...prev,
              assignments: {
                ...prev.assignments,
                [selectedHead]: selectedMembers,
              },
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
    } finally {
      setSaving(false);
    }
  };

  if (error && !data) {
    return (
      <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
        {error}
      </p>
    );
  }
  if (!data) return <p className="text-xs text-slate-500">Завантаження…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-4">
        <label className="mb-1 block text-xs text-slate-600">Головний менеджер</label>
        <select
          value={selectedHead}
          onChange={(e) => setSelectedHead(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1.5 text-sm"
        >
          {data.headManagers.map((h) => (
            <option key={h.id} value={h.id}>
              {(h.name?.trim() || "—") + " · " + h.email}
            </option>
          ))}
        </select>
        {head ? (
          <p className="mt-1 text-[11px] text-slate-500">ID: {head.id}</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-4">
        <p className="mb-2 text-xs font-medium text-slate-700">Його менеджери</p>
        <div className="max-h-72 space-y-1 overflow-auto pr-1">
          {data.managers.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-[var(--enver-hover)]"
            >
              <input
                type="checkbox"
                checked={selectedMembers.includes(m.id)}
                onChange={() => toggleMember(m.id)}
              />
              <span className="text-slate-800">
                {(m.name?.trim() || "—") + " · " + m.email}
              </span>
              <span className="ml-auto text-[10px] text-slate-500">{m.role}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={saving || !selectedHead}
            onClick={() => void save()}
            className="rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? "Збереження…" : "Зберегти ієрархію"}
          </button>
          {ok ? <span className="text-xs text-emerald-700">{ok}</span> : null}
          {error ? <span className="text-xs text-rose-700">{error}</span> : null}
        </div>
      </div>
    </div>
  );
}
