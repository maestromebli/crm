"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { cn } from "../../lib/utils";

type Props = {
  data: DealWorkspacePayload;
};

type LinkableRow = { id: string; code: string; title: string; status: string };

export function DealFinanceProjectLinks({ data }: Props) {
  const router = useRouter();
  const dealId = data.deal.id;
  const rows = data.linkedFinanceProjects ?? [];
  const canManage = data.canManageFinanceProjectLink ?? false;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linkable, setLinkable] = useState<LinkableRow[]>([]);
  const [pickId, setPickId] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadLinkable = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/deals/${dealId}/linkable-projects`, {
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as {
        projects?: LinkableRow[];
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "Не вдалося завантажити");
      const projects = j.projects ?? [];
      setLinkable(projects);
      if (projects.length > 0) {
        setPickId(projects[0].id);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  const onOpenAttach = () => {
    setOpen(true);
    void loadLinkable();
  };

  const attach = async () => {
    if (!pickId) return;
    setBusyId(pickId);
    setErr(null);
    try {
      const r = await fetch(`/api/projects/${pickId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Не вдалося прив’язати");
      setOpen(false);
      setPickId("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusyId(null);
    }
  };

  const unlink = async (projectId: string) => {
    if (!confirm("Відв’язати цей фінансовий проєкт від угоди?")) return;
    setBusyId(projectId);
    setErr(null);
    try {
      const r = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: null }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Не вдалося відв’язати");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusyId(null);
    }
  };

  if (rows.length === 0 && !canManage) {
    return null;
  }

  return (
    <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/60 px-3 py-2 text-sm shadow-sm shadow-slate-900/5">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800/90">
          Фінансовий проєкт
        </p>
        {canManage ? (
          <button
            type="button"
            onClick={onOpenAttach}
            className="rounded-md border border-indigo-300/80 bg-[var(--enver-card)] px-2 py-0.5 text-[11px] font-medium text-indigo-900 hover:bg-indigo-50"
          >
            Прив’язати проєкт
          </button>
        ) : null}
      </div>

      {err ? (
        <p className="mb-2 text-[12px] text-rose-700" role="alert">
          {err}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="mb-2 flex flex-col gap-1.5">
          {rows.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200/40 pb-1.5 last:border-0 last:pb-0"
            >
              <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Link
                  href={`/crm/finance/${p.id}`}
                  className="font-medium text-indigo-950 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900"
                >
                  {p.code} · {p.title}
                </Link>
                <span className="text-[11px] text-indigo-700/80">{p.status}</span>
              </div>
              {canManage ? (
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => void unlink(p.id)}
                  className={cn(
                    "shrink-0 text-[11px] text-rose-700 underline-offset-2 hover:underline",
                    busyId === p.id && "opacity-50",
                  )}
                >
                  Відв’язати
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-[12px] text-indigo-800/80">
          Немає прив’язаного фінансового проєкту.
        </p>
      )}

      {open && canManage ? (
        <div className="mt-2 rounded-lg border border-indigo-200 bg-[var(--enver-card)] p-2">
          <p className="mb-1.5 text-[11px] text-slate-600">
            Проєкти без угоди (з бази). Після прив’язки вони з’являться тут і в модулі фінансів.
          </p>
          {loading ? (
            <p className="text-[12px] text-slate-500">Завантаження…</p>
          ) : linkable.length === 0 ? (
            <p className="text-[12px] text-slate-600">
              Немає вільних проєктів. Створіть проєкт у БД або відв’язайте від іншої угоди.
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={pickId}
                onChange={(e) => setPickId(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1.5 text-[12px] text-[var(--enver-text)]"
              >
                {linkable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.title} ({p.status})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!pickId || busyId === pickId}
                onClick={() => void attach()}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Підтвердити
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 text-[11px] text-slate-600 hover:text-[var(--enver-text)]"
          >
            Скасувати
          </button>
        </div>
      ) : null}
    </div>
  );
}
