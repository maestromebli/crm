"use client";

import { Bookmark, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "../../../../lib/utils";
import type {
  DealHubFilters,
  DealHubSavedViewDTO,
} from "../../../../features/deal-hub/deal-hub-filters";

type Props = {
  views: DealHubSavedViewDTO[];
  getSnapshot: () => DealHubFilters;
  onApply: (filters: DealHubFilters) => void;
  onMutated: () => void;
};

export function DealsSavedViewsBar({
  views,
  getSnapshot,
  onApply,
  onMutated,
}: Props) {
  const [openSave, setOpenSave] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const save = useCallback(async () => {
    setErr(null);
    setBusy(true);
    try {
      const filters = getSnapshot();
      const r = await fetch("/api/user/deal-hub-saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), filters }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Не вдалося зберегти");
      setName("");
      setOpenSave(false);
      onMutated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  }, [getSnapshot, name, onMutated]);

  const remove = useCallback(
    async (id: string) => {
      if (!window.confirm("Видалити збережений вигляд?")) return;
      setBusy(true);
      setErr(null);
      try {
        const r = await fetch(`/api/user/deal-hub-saved-views/${id}`, {
          method: "DELETE",
        });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Не вдалося видалити");
        if (activeId === id) setActiveId(null);
        onMutated();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Помилка");
      } finally {
        setBusy(false);
      }
    },
    [activeId, onMutated],
  );

  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)]/90 px-3 py-2.5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--enver-muted)]">
          <Bookmark className="h-3.5 w-3.5 text-[var(--enver-accent)]" aria-hidden />
          Мої вигляди
        </div>
        <button
          type="button"
          onClick={() => {
            setOpenSave((o) => !o);
            setErr(null);
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-1 text-[10px] font-semibold text-[var(--enver-text-muted)] transition hover:bg-[var(--enver-hover)] hover:text-[var(--enver-text)] sm:ml-0"
        >
          <Plus className="h-3 w-3" aria-hidden />
          Зберегти поточний
        </button>
      </div>

      {openSave ? (
        <div className="mb-3 flex flex-col gap-2 rounded-xl border border-dashed border-[var(--enver-accent)]/40 bg-[var(--enver-accent-soft)]/30 px-2.5 py-2">
          <label className="text-[10px] font-medium text-[var(--enver-text-muted)]">
            Назва (наприклад «Мої без КП»)
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={160}
              placeholder="Назва вигляду"
              className="mt-1 w-full rounded-lg border border-[var(--enver-border)] bg-[var(--enver-input-bg)] px-2.5 py-1.5 text-xs text-[var(--enver-text)] outline-none focus:border-[var(--enver-accent)] focus:ring-2 focus:ring-[var(--enver-accent-ring)]"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void save()}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--enver-accent)] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : null}
              Зберегти
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenSave(false);
                setErr(null);
              }}
              className="text-[11px] font-medium text-[var(--enver-muted)] hover:text-[var(--enver-text)]"
            >
              Скасувати
            </button>
          </div>
          <p className="text-[10px] text-[var(--enver-text-muted)]">
            Зберігаються чіп фільтра, сортування, менеджер, таблиця/дошка, підказки
            та рядок пошуку.
          </p>
        </div>
      ) : null}

      {err ? (
        <p className="mb-2 text-[11px] text-[var(--enver-danger)]">{err}</p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {views.length === 0 && !openSave ? (
          <p className="text-[11px] text-[var(--enver-muted)]">
            Ще немає збережених виглядів — налаштуйте фільтри й натисніть «Зберегти
            поточний».
          </p>
        ) : null}
        {views.map((v) => {
          const active = activeId === v.id;
          return (
            <div
              key={v.id}
              className={cn(
                "group inline-flex max-w-[220px] items-center gap-0.5 overflow-hidden rounded-full border text-[11px] font-semibold transition",
                active
                  ? "border-[var(--enver-accent)] bg-[var(--enver-accent)] text-white shadow-sm"
                  : "border-[var(--enver-border)] bg-[var(--enver-surface)] text-[var(--enver-text-muted)] hover:border-[var(--enver-accent)]/50 hover:bg-[var(--enver-hover)]",
              )}
            >
              <button
                type="button"
                disabled={busy}
                title={v.name}
                onClick={() => {
                  setActiveId(v.id);
                  onApply(v.filters);
                }}
                className="min-w-0 truncate px-2.5 py-1 text-left hover:brightness-110"
              >
                {v.name}
              </button>
              <button
                type="button"
                disabled={busy}
                title="Видалити вигляд"
                onClick={() => void remove(v.id)}
                className={cn(
                  "shrink-0 p-1 opacity-70 transition hover:opacity-100",
                  active ? "text-white" : "text-[var(--enver-muted)]",
                )}
              >
                <Trash2 className="h-3 w-3" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
