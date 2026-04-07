"use client";

/**
 * Поле назви з пошуком по каталозі прайсів.
 * Список — портал (fixed), щоб не обрізався overflow таблиці.
 * Відкривається лише для зфокусованого поля (не для кожного рядка з тим самим текстом).
 */
import { Loader2, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { parseResponseJson } from "../../../lib/api/parse-response-json";
import { cn } from "../../../lib/utils";
import type { MaterialSearchHit } from "../../../lib/materials/material-provider";

export type CatalogMenuRect = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function measureMenuRect(el: HTMLElement): CatalogMenuRect {
  const rect = el.getBoundingClientRect();
  const gap = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  const spaceBelow = vh - rect.bottom - gap;
  const maxHeight = Math.min(360, Math.max(140, Math.floor(spaceBelow)));
  const width = Math.max(rect.width, 220);
  const maxLeft = Math.max(gap, vw - width - gap);
  return {
    top: rect.bottom + 3,
    left: Math.min(Math.max(gap, rect.left), maxLeft),
    width,
    maxHeight,
  };
}

type Props = {
  value: string;
  onChange: (next: string) => void;
  onCatalogPick: (hit: MaterialSearchHit) => void;
  disabled?: boolean;
  className?: string;
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
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [menuRect, setMenuRect] = useState<CatalogMenuRect | null>(null);
  /** Список показуємо лише поки фокус у цьому полі (інакше всі рядки таблиці з довгою назвою відкриють портал). */
  const [inputFocused, setInputFocused] = useState(false);
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
      setLoading(false);
      setNoMatches(false);
      return;
    }
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      setItems([]);
      setNoMatches(false);
      return;
    }

    const ac = new AbortController();
    const t = window.setTimeout(() => {
      setLoading(true);
      setNoMatches(false);
      void (async () => {
        try {
          const r = await fetch(
            `/api/materials/search?q=${encodeURIComponent(q)}&limit=20`,
            { signal: ac.signal },
          );
          const j = await parseResponseJson<{
            items?: MaterialSearchHit[];
          }>(r);
          if (!r.ok) {
            setItems([]);
            setNoMatches(false);
            return;
          }
          const next = j.items ?? [];
          setItems(next);
          setNoMatches(next.length === 0);
          setHighlight(next.length > 0 ? 0 : -1);
        } catch {
          if (!ac.signal.aborted) {
            setItems([]);
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

  const hasQuery = qTrim.length >= minQueryLength;
  const showDropdown = inputFocused && hasQuery;
  const showList = showDropdown && !loading && items.length > 0;
  const showEmpty = showDropdown && !loading && noMatches && items.length === 0;

  const syncMenuPosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el || !showDropdown) {
      setMenuRect(null);
      return;
    }
    setMenuRect(measureMenuRect(el));
  }, [showDropdown]);

  useLayoutEffect(() => {
    syncMenuPosition();
  }, [syncMenuPosition, showDropdown, loading, items.length, noMatches]);

  useEffect(() => {
    if (!showDropdown) return;
    const onScrollOrResize = () => syncMenuPosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [showDropdown, syncMenuPosition]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setInputFocused(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!showList || highlight < 0 || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(
      `[data-catalog-idx="${highlight}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [highlight, showList]);

  const pick = useCallback(
    (hit: MaterialSearchHit) => {
      skipSearchRef.current = true;
      onCatalogPick(hit);
      setInputFocused(false);
      setItems([]);
      setNoMatches(false);
      setMenuRect(null);
    },
    [onCatalogPick],
  );

  const chromeHeader = 28;
  const chromeFooter = 26;
  const chromeLoading = 44;
  const listMaxPx =
    menuRect == null
      ? 220
      : Math.max(
          100,
          menuRect.maxHeight -
            chromeHeader -
            (loading ? chromeLoading : 0) -
            (showList || showEmpty ? chromeFooter : 0),
        );

  const dropdownContent =
    showDropdown && menuRect && typeof document !== "undefined" ? (
      <div
        ref={menuRef}
        id={listId}
        role="listbox"
        onMouseDown={(e) => e.preventDefault()}
        style={{
          position: "fixed",
          top: menuRect.top,
          left: menuRect.left,
          width: menuRect.width,
          maxHeight: menuRect.maxHeight,
          zIndex: 200,
        }}
        className="flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white text-left shadow-md"
      >
        <div className="shrink-0 border-b border-slate-100 bg-slate-50 px-2 py-1">
          <p className="text-[10px] text-slate-500">
            Прайс · Enter — вибрати · Esc — закрити
          </p>
        </div>

        {loading ? (
          <div className="flex shrink-0 items-center gap-2 px-2 py-2 text-[11px] text-slate-600">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-600" />
            Пошук…
          </div>
        ) : null}

        {showList ? (
          <ul
            ref={listRef}
            style={{ maxHeight: listMaxPx }}
            className="divide-y divide-slate-100 overflow-y-auto overscroll-contain"
          >
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
                <li key={`${hit.id}-${i}`} role="presentation">
                  <button
                    type="button"
                    role="option"
                    data-catalog-idx={i}
                    aria-selected={i === highlight}
                    className={cn(
                      "flex w-full flex-col gap-0.5 px-2 py-1.5 text-left text-[11px] leading-snug transition-colors",
                      i === highlight
                        ? "bg-sky-100 text-slate-900"
                        : "text-slate-800 hover:bg-slate-50",
                    )}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(hit)}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 break-words font-medium">
                        {hit.label}
                      </span>
                      {price ? (
                        <span className="shrink-0 tabular-nums text-emerald-800">
                          {price}
                        </span>
                      ) : null}
                    </span>
                    {meta ? (
                      <span className="line-clamp-1 text-[10px] text-slate-500">
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
          <div className="shrink-0 px-2 py-2 text-[11px] text-slate-600">
            <span className="font-medium text-slate-800">Нічого не знайдено</span>
            <span className="mt-0.5 block text-[10px] text-slate-500">
              Залиште свою назву або змініть запит.
            </span>
          </div>
        ) : null}

        {!loading && (showList || showEmpty) ? (
          <div className="shrink-0 border-t border-slate-100 px-2 py-1 text-[9px] text-slate-400">
            ↑ ↓ навігація
          </div>
        ) : null}
      </div>
    ) : null;

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
          onFocus={() => setInputFocused(true)}
          onKeyDown={(e) => {
            if (!showList) {
              if (e.key === "ArrowDown" && items.length > 0 && hasQuery) {
                setInputFocused(true);
                setHighlight(0);
              }
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setInputFocused(false);
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

      {dropdownContent
        ? createPortal(dropdownContent, document.body)
        : null}
    </div>
  );
}
