"use client";

/**
 * Поле назви з пошуком по локальному каталозі прайсів (MaterialCatalogItem).
 */
import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { parseResponseJson } from "../../../lib/api/parse-response-json";
import { cn } from "../../../lib/utils";
import type { MaterialSearchHit } from "../../../lib/materials/material-provider";

type Props = {
  value: string;
  onChange: (next: string) => void;
  onCatalogPick: (hit: MaterialSearchHit) => void;
  disabled?: boolean;
  className?: string;
  /** Мінімальна довжина запиту для пошуку */
  minQueryLength?: number;
};

export function MaterialCatalogCombobox({
  value,
  onChange,
  onCatalogPick,
  disabled,
  className,
  minQueryLength = 2,
}: Props) {
  const listId = useId();
  const hintId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MaterialSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [noMatches, setNoMatches] = useState(false);
  const skipSearchRef = useRef(false);

  const qTrim = value.trim();
  const showHelpHint = qTrim.length > 0 && qTrim.length < minQueryLength;
  const charsLeft = minQueryLength - qTrim.length;
  const symbolWord =
    charsLeft === 1
      ? "символ"
      : charsLeft >= 2 && charsLeft <= 4
        ? "символи"
        : "символів";

  useEffect(() => {
    const q = value.trim();
    if (q.length < minQueryLength) {
      setItems([]);
      setOpen(false);
      setLoading(false);
      setNoMatches(false);
      return;
    }
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      setItems([]);
      setOpen(false);
      setNoMatches(false);
      return;
    }

    const ac = new AbortController();
    const t = window.setTimeout(() => {
      setLoading(true);
      setOpen(true);
      setNoMatches(false);
      void (async () => {
        try {
          const r = await fetch(
            `/api/materials/search?q=${encodeURIComponent(q)}&limit=14`,
            { signal: ac.signal },
          );
          const j = await parseResponseJson<{
            items?: MaterialSearchHit[];
          }>(r);
          if (!r.ok) {
            setItems([]);
            setOpen(false);
            setNoMatches(false);
            return;
          }
          const next = j.items ?? [];
          setItems(next);
          setNoMatches(next.length === 0);
          setOpen(true);
          setHighlight(next.length > 0 ? 0 : -1);
        } catch {
          if (!ac.signal.aborted) {
            setItems([]);
            setOpen(false);
            setNoMatches(false);
          }
        } finally {
          if (!ac.signal.aborted) setLoading(false);
        }
      })();
    }, 280);

    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [value, minQueryLength]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = useCallback(
    (hit: MaterialSearchHit) => {
      skipSearchRef.current = true;
      onCatalogPick(hit);
      setOpen(false);
      setItems([]);
      setNoMatches(false);
    },
    [onCatalogPick],
  );

  const showDropdown = open && qTrim.length >= minQueryLength;
  const showList = showDropdown && !loading && items.length > 0;
  const showEmpty = showDropdown && !loading && noMatches && items.length === 0;

  return (
    <div ref={wrapRef} className="relative w-full min-w-0">
      <div className="relative flex w-full items-stretch gap-0">
        <span
          className="pointer-events-none absolute left-1.5 top-1/2 z-[1] -translate-y-1/2 text-slate-400"
          aria-hidden
        >
          <Search className="h-3.5 w-3.5" />
        </span>
        <input
          type="text"
          id={hintId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (items.length > 0 || noMatches || loading) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!showList) {
              if (e.key === "ArrowDown" && items.length > 0) {
                setOpen(true);
                setHighlight(0);
              }
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) =>
                Math.min(items.length - 1, Math.max(0, h) + 1),
              );
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
              return;
            }
            if (e.key === "Enter" && highlight >= 0) {
              e.preventDefault();
              const hit = items[highlight];
              if (hit) pick(hit);
            }
          }}
          disabled={disabled}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listId : undefined}
          aria-autocomplete="list"
          aria-describedby={showHelpHint ? `${hintId}-tip` : undefined}
          className={cn(
            "w-full min-w-[12rem] rounded-lg border border-slate-200/90 bg-white/80 pl-8 pr-2 py-1.5 text-left shadow-sm transition-[box-shadow,border-color]",
            "placeholder:text-slate-400 hover:border-slate-300 hover:bg-white",
            "focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-200/80",
            disabled && "cursor-not-allowed opacity-60",
            className,
          )}
          placeholder="Введіть назву — підказки з прайсу…"
          title="Введіть щонайменше 2 символи, щоб з’явився список з бази прайсів. Клік по рядку заповнить ціну та одиницю."
        />
      </div>
      {showHelpHint ? (
        <p
          id={`${hintId}-tip`}
          className="mt-0.5 text-[10px] leading-tight text-slate-500"
        >
          Ще {charsLeft} {symbolWord} — і відкриється пошук по прайсу
        </p>
      ) : null}

      {showDropdown ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[70] mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-lg ring-1 ring-black/5"
        >
          <div className="border-b border-slate-100 bg-slate-50/95 px-2.5 py-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Каталог прайсів
            </p>
            <p className="text-[11px] text-slate-600">
              Оберіть рядок — підставляться назва, ціна та од. виміру. Або
              введіть текст без вибору.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-[11px] text-slate-600">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-600" />
              Шукаю в базі прайсів…
            </div>
          ) : null}

          {showList ? (
            <ul className="max-h-52 overflow-auto py-1">
              {items.map((hit, i) => {
                const price =
                  typeof hit.unitPrice === "number"
                    ? `${hit.unitPrice.toLocaleString("uk-UA")} ${hit.currency ?? "грн"}/${hit.unit ?? "од."}`
                    : null;
                const meta = [hit.category, hit.brand, hit.providerKey]
                  .filter(Boolean)
                  .slice(0, 2)
                  .join(" · ");
                return (
                  <li key={hit.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === highlight}
                      className={cn(
                        "flex w-full flex-col gap-0.5 border-l-2 border-transparent px-2.5 py-2 text-left text-[11px] leading-tight transition-colors hover:border-sky-400 hover:bg-sky-50/90",
                        i === highlight &&
                          "border-sky-500 bg-sky-50/90",
                      )}
                      onMouseEnter={() => setHighlight(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(hit)}
                    >
                      <span className="font-medium text-slate-900">
                        {hit.label}
                      </span>
                      {price ? (
                        <span className="tabular-nums text-emerald-800">
                          {price}
                        </span>
                      ) : null}
                      {meta ? (
                        <span className="text-[10px] text-slate-500">
                          {meta}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {showEmpty ? (
            <div className="px-3 py-4 text-[11px] leading-snug text-slate-600">
              <p className="font-medium text-slate-800">Нічого не знайдено</p>
              <p className="mt-1">
                Можна залишити свою назву — сума все одно порахується. Спробуйте
                інше ключове слово або коротшу назву.
              </p>
            </div>
          ) : null}

          {!loading && (showList || showEmpty) ? (
            <div className="border-t border-slate-100 bg-slate-50/80 px-2.5 py-1.5 text-[10px] text-slate-500">
              <span className="hidden sm:inline">
                ↑ ↓ — рухатися · Enter — вибрати · Esc — закрити
              </span>
              <span className="sm:hidden">Натисніть рядок, щоб обрати</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
