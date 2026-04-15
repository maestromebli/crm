"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { ComponentType } from "react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Clock, Maximize2, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getVisibleNavSections } from "@/lib/navigation-visible";
import { getFocusableElements } from "./crm-focus-trap";
import {
  POPULAR_NAV_PRESETS,
  pickBestHighlightQuery,
  pushRecentNav,
  readRecentNav,
  scoreNavItem,
} from "./crm-command-palette";

const MAX_RESULTS = 12;
const MAX_RECENT_STORE = 24;
const LISTBOX_ID = "crm-global-search-results";
const LISTBOX_MODAL_ID = "crm-global-search-results-modal";

export type NavSearchItem = {
  id: string;
  label: string;
  href: string;
  scope: "Розділ" | "Підрозділ" | "Команда";
  searchableText: string;
  sectionId: string;
  Icon: ComponentType<{ className?: string }>;
};

type CrmCommandPaletteProps = {
  /** Для підняття шапки над dim-backdrop (z-index). */
  onOpenChange?: (open: boolean) => void;
};

const SYNONYMS_BY_SECTION: Record<string, string[]> = {
  dashboard: ["огляд", "контроль", "kpi"],
  leads: ["ліди", "продажі", "воронка", "клієнти"],
  contacts: ["контакти", "клієнти", "база"],
  deals: ["угоди", "проєкти", "контракти"],
  calendar: ["календар", "зустрічі", "монтажі"],
  inbox: ["вхідні", "повідомлення", "telegram", "чат"],
  finance: ["фінанси", "оплати", "каса", "платежі", "cashflow"],
  procurement: ["закупівлі", "постачальники", "po", "матеріали"],
  production: ["виробництво", "цех", "kanban", "монтаж"],
  handoff: ["передача", "приймання", "чек-лист"],
  tasks: ["задачі", "план", "дедлайн"],
  files: ["файли", "документи", "шаблони"],
  reports: ["звіти", "аналітика", "метрики"],
  settings: ["налаштування", "права", "ролі"],
};

const ACTION_COMMANDS: Array<{
  id: string;
  label: string;
  href: string;
  searchable: string;
  requiredSectionId?: string;
}> = [
  {
    id: "action:today-priorities",
    label: "Команда · Мої пріоритети сьогодні",
    href: "/tasks/today",
    searchable: "today priorities задачі день пріоритети",
    requiredSectionId: "tasks",
  },
  {
    id: "action:followup",
    label: "Команда · Потрібен повторний контакт",
    href: "/leads",
    searchable: "повторний контакт follow-up ліди контакт нагадування",
    requiredSectionId: "leads",
  },
  {
    id: "action:risky-deals",
    label: "Команда · Ризикові угоди",
    href: "/crm/dashboard?view=issues",
    searchable: "ризики угоди problems issues",
    requiredSectionId: "dashboard",
  },
  {
    id: "action:calendar-measurements",
    label: "Команда · Запланувати замір",
    href: "/calendar/measurements",
    searchable: "замір measurement календар schedule",
    requiredSectionId: "calendar",
  },
];

function buildNavIndex(sections: ReturnType<typeof getVisibleNavSections>): NavSearchItem[] {
  const items: NavSearchItem[] = [];
  const visibleSectionIds = new Set(sections.map((section) => section.id));
  for (const section of sections) {
    const sectionSyn = SYNONYMS_BY_SECTION[section.id]?.join(" ") ?? "";
    items.push({
      id: section.id,
      label: section.label,
      href: section.href,
      scope: "Розділ",
      searchableText: `${section.label} ${section.href} ${sectionSyn}`.toLowerCase(),
      sectionId: section.id,
      Icon: section.icon,
    });
    for (const sub of section.subItems ?? []) {
      items.push({
        id: `${section.id}:${sub.id}`,
        label: `${section.label} · ${sub.label}`,
        href: sub.href,
        scope: "Підрозділ",
        searchableText: `${section.label} ${sub.label} ${sub.href} ${sectionSyn}`.toLowerCase(),
        sectionId: section.id,
        Icon: section.icon,
      });
    }
  }
  for (const command of ACTION_COMMANDS) {
    if (
      command.requiredSectionId &&
      !visibleSectionIds.has(command.requiredSectionId)
    ) {
      continue;
    }
    items.push({
      id: command.id,
      label: command.label,
      href: command.href,
      scope: "Команда",
      searchableText: `${command.label} ${command.href} ${command.searchable}`.toLowerCase(),
      sectionId: "actions",
      Icon: Sparkles,
    });
  }
  return items;
}

function itemByHref(href: string, index: NavSearchItem[]): NavSearchItem | undefined {
  return index.find((x) => x.href === href);
}

function emptyStateItems(index: NavSearchItem[]): NavSearchItem[] {
  const recentRaw = readRecentNav(8);
  const seen = new Set<string>();
  const out: NavSearchItem[] = [];

  for (const r of recentRaw) {
    if (seen.has(r.href)) continue;
    seen.add(r.href);
    const known = itemByHref(r.href, index);
    if (known) {
      out.push({ ...known, label: known.label });
    } else {
      out.push({
        id: `recent:${r.href}`,
        label: r.label,
        href: r.href,
        scope: "Підрозділ",
        searchableText: `${r.label} ${r.href}`.toLowerCase(),
        sectionId: "recent",
        Icon: Clock,
      });
    }
    if (out.length >= MAX_RESULTS) return out;
  }

  for (const p of POPULAR_NAV_PRESETS) {
    if (seen.has(p.href)) continue;
    seen.add(p.href);
    const known = itemByHref(p.href, index);
    out.push(
      known ?? {
        id: p.id,
        label: p.label,
        href: p.href,
        scope: "Підрозділ",
        searchableText: `${p.label} ${p.href}`.toLowerCase(),
        sectionId: "popular",
        Icon: Sparkles,
      },
    );
    if (out.length >= MAX_RESULTS) break;
  }

  return out;
}

function searchItems(index: NavSearchItem[], query: string): NavSearchItem[] {
  const q = query.trim();
  if (!q) return emptyStateItems(index);
  const scored = index
    .map((item) => {
      const s = scoreNavItem(item, q);
      return s < 0 ? null : { item, score: s };
    })
    .filter((x): x is { item: NavSearchItem; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((x) => x.item);
  return scored;
}

function closeAll(
  setSearchOpen: (v: boolean) => void,
  setExpanded: (v: boolean) => void,
  setSearchQuery: (v: string) => void,
) {
  setSearchOpen(false);
  setExpanded(false);
  setSearchQuery("");
}

export function CrmCommandPalette({ onOpenChange }: CrmCommandPaletteProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useSession();
  const keys = useMemo(() => data?.user?.permissionKeys ?? [], [data?.user?.permissionKeys]);
  const realRole = data?.user?.realRole;
  const impersonatorId = data?.user?.impersonatorId;
  const menuAccess = data?.user?.menuAccess ?? null;
  const visibleSections = useMemo(
    () =>
      getVisibleNavSections({
        permissionKeys: keys,
        realRole,
        impersonatorId,
        menuAccess,
      }),
    [impersonatorId, keys, menuAccess, realRole],
  );
  const navIndex = useMemo(() => buildNavIndex(visibleSections), [visibleSections]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [recentTick, setRecentTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const modalPanelRef = useRef<HTMLDivElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const prevExpandedRef = useRef(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  /** Після закриття модалки повертаємо фокус на кнопку «повний екран» (a11y). */
  useEffect(() => {
    if (prevExpandedRef.current && !expanded) {
      window.setTimeout(() => {
        expandButtonRef.current?.focus();
      }, 0);
    }
    prevExpandedRef.current = expanded;
  }, [expanded]);

  const filteredQuickLinks = useMemo(() => {
    void recentTick;
    return searchItems(navIndex, searchQuery);
  }, [navIndex, searchQuery, recentTick]);

  const groupedQuickLinks = useMemo(
    () => ({
      sections: filteredQuickLinks.filter((item) => item.scope === "Розділ"),
      subSections: filteredQuickLinks.filter((item) => item.scope === "Підрозділ"),
      commands: filteredQuickLinks.filter((item) => item.scope === "Команда"),
    }),
    [filteredQuickLinks],
  );

  const flatIndex = useMemo(() => {
    const map = new Map<string, number>();
    filteredQuickLinks.forEach((item, i) => map.set(item.id, i));
    return map;
  }, [filteredQuickLinks]);

  const overlayActive = searchOpen || expanded;

  useEffect(() => {
    onOpenChange?.(overlayActive);
  }, [overlayActive, onOpenChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActiveSearchIndex((prev) => {
        const max = Math.max(filteredQuickLinks.length - 1, 0);
        if (filteredQuickLinks.length === 0) return 0;
        return Math.min(prev, max);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [filteredQuickLinks]);

  useEffect(() => {
    const timer = window.setTimeout(() => setActiveSearchIndex(0), 0);
    return () => window.clearTimeout(timer);
  }, [searchQuery, searchOpen, expanded]);

  useEffect(() => {
    if (expanded) {
      window.setTimeout(() => {
        const el = document.getElementById("crm-global-search-modal") as HTMLInputElement | null;
        el?.focus();
        el?.select();
      }, 0);
    }
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [expanded]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const k = event.key.toLowerCase();
      const shiftCtrlK = event.shiftKey && (event.ctrlKey || event.metaKey) && k === "k";
      const ctrlK = !event.shiftKey && (event.ctrlKey || event.metaKey) && k === "k";

      if (shiftCtrlK) {
        event.preventDefault();
        setExpanded((prev) => {
          if (prev) {
            closeAll(setSearchOpen, setExpanded, setSearchQuery);
            return false;
          }
          setSearchOpen(true);
          return true;
        });
        return;
      }

      if (ctrlK) {
        event.preventDefault();
        setExpanded(false);
        setSearchOpen(true);
        window.setTimeout(() => {
          const el = document.getElementById("crm-global-search") as HTMLInputElement | null;
          el?.focus();
          el?.select();
        }, 0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen && !expanded) return;
    const id = filteredQuickLinks[activeSearchIndex]?.id;
    if (!id) return;
    const suffix = expanded ? "-modal" : "";
    const node = document.getElementById(`crm-search-result-${id}${suffix}`);
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSearchIndex, filteredQuickLinks, searchOpen, expanded]);

  useEffect(() => {
    const timer = window.setTimeout(() => setRecentTick((n) => n + 1), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!expanded || !modalPanelRef.current) return;
    const root = modalPanelRef.current;
    const onTab = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = getFocusableElements(root);
      if (nodes.length < 2) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };
    root.addEventListener("keydown", onTab);
    return () => root.removeEventListener("keydown", onTab);
  }, [expanded, filteredQuickLinks]);

  const navigateTo = useCallback(
    (item: NavSearchItem) => {
      pushRecentNav({ id: item.id, href: item.href, label: item.label }, MAX_RECENT_STORE);
      setRecentTick((n) => n + 1);
      closeAll(setSearchOpen, setExpanded, setSearchQuery);
      router.push(item.href);
    },
    [router],
  );

  const applyQuickFilter = useCallback((q: string) => {
    setSearchQuery(q);
    setSearchOpen(true);
    setActiveSearchIndex(0);
  }, []);

  const handleKeyNav = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (!searchOpen && !expanded) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSearchIndex((prev) => {
          const max = Math.max(filteredQuickLinks.length - 1, 0);
          return filteredQuickLinks.length ? (prev >= max ? 0 : prev + 1) : 0;
        });
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSearchIndex((prev) => {
          const max = Math.max(filteredQuickLinks.length - 1, 0);
          return filteredQuickLinks.length ? (prev <= 0 ? max : prev - 1) : 0;
        });
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (expanded) {
          closeAll(setSearchOpen, setExpanded, setSearchQuery);
        } else {
          setSearchOpen(false);
        }
        return;
      }
      if (event.key === "Enter") {
        const target = filteredQuickLinks[activeSearchIndex];
        if (!target) return;
        event.preventDefault();
        navigateTo(target);
      }
    },
    [activeSearchIndex, expanded, filteredQuickLinks, navigateTo, searchOpen],
  );

  const showEmptyHint = !searchQuery.trim() && filteredQuickLinks.length > 0;
  const showInlineDropdown = searchOpen && !expanded;
  const listboxId = expanded ? LISTBOX_MODAL_ID : LISTBOX_ID;
  const activeDescId =
    (searchOpen || expanded) && filteredQuickLinks[activeSearchIndex]
      ? `crm-search-result-${filteredQuickLinks[activeSearchIndex].id}${expanded ? "-modal" : ""}`
      : undefined;

  const inlineBackdropOnly = mounted && searchOpen && !expanded;
  const dur = reduceMotion ? 0 : 0.22;
  const ease = [0.16, 1, 0.3, 1] as const;

  const inlineBackdrop = inlineBackdropOnly
    ? createPortal(
        <div
          className="fixed inset-0 z-[90] bg-slate-900/35 backdrop-blur-[2px] transition-opacity"
          role="presentation"
          aria-hidden
          onMouseDown={(e) => {
            e.preventDefault();
            closeAll(setSearchOpen, setExpanded, setSearchQuery);
          }}
        />,
        document.body,
      )
    : null;

  const modal = mounted
    ? createPortal(
        <AnimatePresence mode="sync">
          {expanded ? (
            <>
              <motion.div
                key="crm-modal-backdrop"
                role="presentation"
                aria-hidden
                className="fixed inset-0 z-[105] bg-slate-950/55 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  closeAll(setSearchOpen, setExpanded, setSearchQuery);
                }}
              />
              <div
                className="pointer-events-none fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto px-4 pb-10 pt-[min(12vh,6rem)]"
                role="dialog"
                aria-modal="true"
                aria-label="Палітра команд — повноекранний режим"
              >
                <motion.div
                  ref={modalPanelRef}
                  key="crm-modal-panel"
                  className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-surface-elevated)] shadow-[0_24px_64px_rgba(15,23,42,0.2)] ring-1 ring-black/[0.06]"
                  initial={{ opacity: 0, y: reduceMotion ? 0 : -14, scale: reduceMotion ? 1 : 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: reduceMotion ? 0 : -8, scale: reduceMotion ? 1 : 0.98 }}
                  transition={{ duration: dur, ease }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between gap-2 border-b border-[var(--enver-border)] px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 shrink-0 text-[var(--enver-accent)]" aria-hidden />
                          <span className="truncate text-sm font-semibold text-[var(--enver-text)]">Куди перейти?</span>
                        </div>
                        <p className="mt-0.5 pl-6 text-[11px] leading-snug text-[var(--enver-muted)]">
                          Введіть слово з назви або виберіть зі списку — без пошуку в боковому меню.
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="hidden max-w-[9rem] text-right text-[10px] leading-tight text-[var(--enver-muted)] sm:inline">
                          Згорнути: Shift+Ctrl+K
                        </span>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-[var(--enver-muted)] transition hover:bg-[var(--enver-hover)] hover:text-[var(--enver-text)]"
                          aria-label="Закрити"
                          onClick={() => closeAll(setSearchOpen, setExpanded, setSearchQuery)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="relative">
                        <Search
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50"
                          aria-hidden
                        />
                        <input
                          id="crm-global-search-modal"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setSearchOpen(true);
                          }}
                          onKeyDown={handleKeyNav}
                          placeholder="Наприклад: ліди, оплати, цех, звіти…"
                          className="h-11 w-full rounded-xl border border-[var(--enver-border)] bg-[var(--enver-bg)] pl-10 pr-3 text-sm text-[var(--enver-text)] shadow-inner outline-none transition focus:border-[var(--enver-accent)] focus:ring-2 focus:ring-[var(--enver-accent-ring)]"
                          aria-label="Пошук у повноекранній палітрі"
                          aria-describedby="crm-search-modal-hint"
                          aria-controls={LISTBOX_MODAL_ID}
                          aria-activedescendant={activeDescId}
                          autoComplete="off"
                        />
                      </div>
                      <p id="crm-search-modal-hint" className="sr-only">
                        Можна шукати українською та латиницею; підтримуються синоніми на кшталт «оплати» для фінансів.
                      </p>
                    </div>
                    <PaletteResults
                      variant="modal"
                      listboxId={LISTBOX_MODAL_ID}
                      idSuffix="-modal"
                      filteredQuickLinks={filteredQuickLinks}
                      groupedQuickLinks={groupedQuickLinks}
                      flatIndex={flatIndex}
                      activeSearchIndex={activeSearchIndex}
                      setActiveSearchIndex={setActiveSearchIndex}
                      pathname={pathname}
                      searchQuery={searchQuery}
                      showEmptyHint={showEmptyHint}
                      navigateTo={navigateTo}
                      onQuickFilter={applyQuickFilter}
                    />
                </motion.div>
              </div>
            </>
          ) : null}
        </AnimatePresence>,
        document.body,
      )
    : null;

  return (
    <>
      {inlineBackdrop}
      {modal}

      <div
        className={cn(
          "relative flex min-w-0 max-w-[min(100%,26rem)] flex-1 items-center md:max-w-lg",
          overlayActive && "z-[100]",
        )}
        onFocus={() => setSearchOpen(true)}
        onBlur={(event) => {
          if (expanded) return;
          const next = event.relatedTarget as Node | null;
          if (!next || !event.currentTarget.contains(next)) {
            setSearchOpen(false);
          }
        }}
      >
        <label htmlFor="crm-global-search" className="sr-only">
          Швидкий перехід по CRM
        </label>
        <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 opacity-50 md:h-4 md:w-4" aria-hidden />
        <input
          id="crm-global-search"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={handleKeyNav}
          placeholder="Куди перейти? (ліди, фінанси, задачі…)"
          className="h-9 w-full rounded-full border border-[var(--enver-border)] bg-[var(--enver-bg)] pl-9 pr-[6.5rem] text-[11px] text-[var(--enver-text)] shadow-[var(--enver-shadow)] outline-none ring-0 transition focus:border-[var(--enver-accent)] focus:ring-2 focus:ring-[var(--enver-accent-ring)] md:pr-[9.5rem] md:text-xs lg:pr-[11rem]"
          aria-label="Швидкий перехід: введіть назву розділу або оберіть зі списку"
          aria-describedby="crm-inline-search-hint"
          aria-controls={LISTBOX_ID}
          aria-activedescendant={!expanded ? activeDescId : undefined}
          autoComplete="off"
        />
        <span id="crm-inline-search-hint" className="sr-only">
          Відкрити велике вікно пошуку можна кнопкою праворуч або Shift+Ctrl+K. Закрити список — Esc.
        </span>
        <span className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 text-[10px] text-[var(--enver-muted)] md:flex md:right-[7.25rem] lg:right-[9.5rem]">
          <kbd className="rounded border border-[var(--enver-border)] bg-[var(--enver-surface)] px-1.5 py-0.5 font-mono text-[10px]">Ctrl</kbd>
          <span className="opacity-70">/</span>
          <kbd className="rounded border border-[var(--enver-border)] bg-[var(--enver-surface)] px-1.5 py-0.5 font-mono text-[10px]">⌘</kbd>
          <span>+</span>
          <kbd className="rounded border border-[var(--enver-border)] bg-[var(--enver-surface)] px-1.5 py-0.5 font-mono text-[10px]">K</kbd>
        </span>
        <button
          ref={expandButtonRef}
          type="button"
          id="crm-command-palette-expand"
          className="absolute right-1.5 top-1/2 flex h-8 max-w-[calc(100%-2rem)] -translate-y-1/2 items-center gap-1 rounded-full border border-transparent px-1.5 text-[var(--enver-muted)] transition hover:border-[var(--enver-border)] hover:bg-[var(--enver-hover)] hover:text-[var(--enver-accent)] md:right-2 md:max-w-none"
          title="Відкрити велике вікно пошуку (зручніше на великому екрані). Скорочення: Shift+Ctrl+K"
          aria-label="Відкрити велике вікно швидкого переходу"
          aria-haspopup="dialog"
          aria-expanded={expanded}
          aria-controls={expanded ? LISTBOX_MODAL_ID : undefined}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setExpanded(true);
            setSearchOpen(true);
            window.setTimeout(() => {
              document.getElementById("crm-global-search-modal")?.focus();
            }, 0);
          }}
        >
          <Maximize2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="hidden max-w-[5.5rem] truncate text-[10px] font-medium lg:inline">Більше місця</span>
        </button>

        {showInlineDropdown ? (
          <div className="absolute left-0 top-[calc(100%+8px)] z-[100] w-full overflow-hidden rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-surface-elevated)] shadow-[var(--enver-shadow-lg)] ring-1 ring-black/[0.04]">
            <PaletteResults
              variant="inline"
              listboxId={LISTBOX_ID}
              idSuffix=""
              filteredQuickLinks={filteredQuickLinks}
              groupedQuickLinks={groupedQuickLinks}
              flatIndex={flatIndex}
              activeSearchIndex={activeSearchIndex}
              setActiveSearchIndex={setActiveSearchIndex}
              pathname={pathname}
              searchQuery={searchQuery}
              showEmptyHint={showEmptyHint}
              navigateTo={navigateTo}
              onQuickFilter={applyQuickFilter}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

type PaletteResultsProps = {
  variant: "inline" | "modal";
  listboxId: string;
  idSuffix: string;
  filteredQuickLinks: NavSearchItem[];
  groupedQuickLinks: {
    sections: NavSearchItem[];
    subSections: NavSearchItem[];
    commands: NavSearchItem[];
  };
  flatIndex: Map<string, number>;
  activeSearchIndex: number;
  setActiveSearchIndex: (n: number) => void;
  pathname: string | null;
  searchQuery: string;
  showEmptyHint: boolean;
  navigateTo: (item: NavSearchItem) => void;
  onQuickFilter: (query: string) => void;
};

const QUICK_FILTER_CHIPS: Array<{ label: string; q: string }> = [
  { label: "Ліди", q: "лід" },
  { label: "Фінанси", q: "фінанс" },
  { label: "Угоди", q: "угод" },
  { label: "Задачі", q: "задач" },
  { label: "Виробництво", q: "вироб" },
  { label: "Звіти", q: "звіт" },
];

function scopeLabel(item: NavSearchItem): string {
  if (item.sectionId === "recent") return "Було недавно";
  if (item.sectionId === "popular") return "Часто треба";
  if (item.scope === "Команда") return "Команда";
  return item.scope === "Розділ" ? "Розділ" : "Сторінка";
}

function PaletteResults({
  variant,
  listboxId,
  idSuffix,
  filteredQuickLinks,
  groupedQuickLinks,
  flatIndex,
  activeSearchIndex,
  setActiveSearchIndex,
  pathname,
  searchQuery,
  showEmptyHint,
  navigateTo,
  onQuickFilter,
}: PaletteResultsProps) {
  const listMaxH = variant === "modal" ? "max-h-[min(60vh,28rem)]" : "max-h-[min(70vh,22rem)]";

  if (filteredQuickLinks.length === 0) {
    return (
      <div className="border-t border-[var(--enver-border)] px-3 py-6 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--enver-accent-soft)] text-[var(--enver-accent)]">
            <Search className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-[var(--enver-text)]">За цим запитом нічого немає</p>
          <p className="text-[11px] leading-relaxed text-[var(--enver-text-muted)]">
            Спробуйте коротше слово або натисніть підказку — пошук розуміє синоніми (наприклад «оплати» для фінансів).
          </p>
          <p className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
            Швидкі підказки
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {QUICK_FILTER_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className="rounded-full border border-[var(--enver-border)] bg-[var(--enver-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--enver-text)] shadow-sm transition hover:border-[var(--enver-accent)]/50 hover:bg-[var(--enver-accent-soft)]"
                onClick={() => onQuickFilter(chip.q)}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-[var(--enver-muted)]">Або відкрийте потрібний розділ у меню зліва.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showEmptyHint ? (
        <div className="flex gap-2 border-b border-[var(--enver-border)] bg-gradient-to-r from-[var(--enver-accent-soft)]/50 to-transparent px-3 py-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enver-accent)]" aria-hidden />
          <div className="min-w-0 text-[11px] leading-snug text-[var(--enver-text-muted)]">
            <p className="font-medium text-[var(--enver-text)]">З чого почати</p>
            <p className="mt-0.5">
              Зверху — недавні та популярні екрани. Почніть друкувати (наприклад «цех» або «оплати») — список
              відфільтрується по всьому меню.
            </p>
          </div>
        </div>
      ) : null}
      <div id={listboxId} role="listbox" className={cn("overflow-y-auto p-1.5", listMaxH)}>
        {groupedQuickLinks.sections.length > 0 ? (
          <>
            <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
              Головні розділи
            </p>
            {groupedQuickLinks.sections.map((item) => {
              const index = flatIndex.get(item.id) ?? 0;
              const Icon = item.Icon;
              return (
                <Link
                  key={item.id}
                  id={`crm-search-result-${item.id}${idSuffix}`}
                  role="option"
                  aria-selected={index === activeSearchIndex}
                  href={item.href}
                  onMouseEnter={() => setActiveSearchIndex(index)}
                  onClick={() => navigateTo(item)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2.5 py-2.5 text-xs transition-colors",
                    variant === "modal" && "py-3 text-sm",
                    index === activeSearchIndex
                      ? "bg-[var(--enver-accent-soft)] text-[var(--enver-accent-hover)]"
                      : pathname === item.href
                        ? "bg-[var(--enver-accent-soft)]/60 text-[var(--enver-accent-hover)]"
                        : "text-[var(--enver-text)] hover:bg-[var(--enver-hover)]",
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--enver-bg)] text-[var(--enver-accent)] ring-1 ring-[var(--enver-border)]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {highlightMatch(item.label, pickBestHighlightQuery(item.label, searchQuery))}
                  </span>
                  <span className="shrink-0 text-[10px] text-[var(--enver-muted)]">{scopeLabel(item)}</span>
                </Link>
              );
            })}
          </>
        ) : null}
        {groupedQuickLinks.subSections.length > 0 ? (
          <>
            <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
              Конкретні сторінки
            </p>
            {groupedQuickLinks.subSections.map((item) => {
              const index = flatIndex.get(item.id) ?? 0;
              const Icon = item.Icon;
              return (
                <Link
                  key={item.id}
                  id={`crm-search-result-${item.id}${idSuffix}`}
                  role="option"
                  aria-selected={index === activeSearchIndex}
                  href={item.href}
                  onMouseEnter={() => setActiveSearchIndex(index)}
                  onClick={() => navigateTo(item)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2.5 py-2.5 text-xs transition-colors",
                    variant === "modal" && "py-3 text-sm",
                    index === activeSearchIndex
                      ? "bg-[var(--enver-accent-soft)] text-[var(--enver-accent-hover)]"
                      : pathname === item.href
                        ? "bg-[var(--enver-accent-soft)]/60 text-[var(--enver-accent-hover)]"
                        : "text-[var(--enver-text)] hover:bg-[var(--enver-hover)]",
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--enver-bg)] text-[var(--enver-accent)] ring-1 ring-[var(--enver-border)]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {highlightMatch(item.label, pickBestHighlightQuery(item.label, searchQuery))}
                  </span>
                  <span className="shrink-0 text-[10px] text-[var(--enver-muted)]">{scopeLabel(item)}</span>
                </Link>
              );
            })}
          </>
        ) : null}
        {groupedQuickLinks.commands.length > 0 ? (
          <>
            <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
              Швидкі команди
            </p>
            {groupedQuickLinks.commands.map((item) => {
              const index = flatIndex.get(item.id) ?? 0;
              const Icon = item.Icon;
              return (
                <Link
                  key={item.id}
                  id={`crm-search-result-${item.id}${idSuffix}`}
                  role="option"
                  aria-selected={index === activeSearchIndex}
                  href={item.href}
                  onMouseEnter={() => setActiveSearchIndex(index)}
                  onClick={() => navigateTo(item)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2.5 py-2.5 text-xs transition-colors",
                    variant === "modal" && "py-3 text-sm",
                    index === activeSearchIndex
                      ? "bg-[var(--enver-accent-soft)] text-[var(--enver-accent-hover)]"
                      : pathname === item.href
                        ? "bg-[var(--enver-accent-soft)]/60 text-[var(--enver-accent-hover)]"
                        : "text-[var(--enver-text)] hover:bg-[var(--enver-hover)]",
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--enver-bg)] text-[var(--enver-accent)] ring-1 ring-[var(--enver-border)]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {highlightMatch(item.label, pickBestHighlightQuery(item.label, searchQuery))}
                  </span>
                  <span className="shrink-0 text-[10px] text-[var(--enver-muted)]">{scopeLabel(item)}</span>
                </Link>
              );
            })}
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--enver-border)] bg-[var(--enver-bg)]/80 px-3 py-2 text-[10px] text-[var(--enver-muted)]">
        <span className="leading-relaxed">
          <kbd className="rounded border border-[var(--enver-border)] bg-[var(--enver-card)] px-1 font-mono">↑</kbd>
          <kbd className="rounded border border-[var(--enver-border)] bg-[var(--enver-card)] px-1 font-mono">↓</kbd>{" "}
          вибрати ·{" "}
          <kbd className="rounded border border-[var(--enver-border)] bg-[var(--enver-card)] px-1 font-mono">Enter</kbd>{" "}
          перейти ·{" "}
          <kbd className="rounded border border-[var(--enver-border)] bg-[var(--enver-card)] px-1 font-mono">Esc</kbd>{" "}
          закрити
          {variant === "modal" ? (
            <>
              {" "}
              ·{" "}
              <kbd className="rounded border border-[var(--enver-border)] bg-[var(--enver-card)] px-1 font-mono">
                Shift+Ctrl+K
              </kbd>{" "}
              згорнути вікно
            </>
          ) : null}
        </span>
        <span className="hidden text-[var(--enver-text-muted)] sm:inline">Швидкий перехід ENVER</span>
      </div>
    </>
  );
}

function highlightMatch(text: string, highlightQuery: string) {
  const q = highlightQuery.trim();
  if (!q) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);
  if (matchIndex === -1) return text;
  const start = text.slice(0, matchIndex);
  const match = text.slice(matchIndex, matchIndex + q.length);
  const end = text.slice(matchIndex + q.length);
  return (
    <>
      {start}
      <mark className="rounded bg-[var(--enver-warning-soft)] px-0.5 font-medium text-inherit">{match}</mark>
      {end}
    </>
  );
}
