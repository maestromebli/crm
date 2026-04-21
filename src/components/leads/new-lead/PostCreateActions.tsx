"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { normalizePhoneDigits } from "../../../lib/leads/phone-normalize";
import { cn } from "../../../lib/utils";

type PostCreateActionsProps = {
  leadId: string;
  phone: string | null;
  /** HEAD / ADMIN: додаткові плитки призначення та хабу. */
  showSupervisorFlow?: boolean;
};

function telHref(phone: string | null): string | null {
  if (!phone?.trim()) return null;
  const t = phone.trim();
  if (t.startsWith("+")) return `tel:${t.replace(/\s/g, "")}`;
  const d = normalizePhoneDigits(t);
  if (d.length < 9) return null;
  return `tel:+${d}`;
}

const tileClass = cn(
  "flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2.5 text-center transition",
  "border-slate-200 bg-[var(--enver-card)] text-[var(--enver-text)] shadow-sm",
  "hover:border-slate-300 hover:bg-[var(--enver-hover)]",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
);

/** Панель після створення ліда (`?fresh=1`) — сценарій «Що далі?». */
export function PostCreateActions({
  leadId,
  phone,
  showSupervisorFlow = false,
}: PostCreateActionsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const show = searchParams.get("fresh") === "1";
  const tel = telHref(phone);

  const clearFresh = useCallback(() => {
    router.replace(`/leads/${leadId}`, { scroll: false });
  }, [leadId, router]);

  if (!show) return null;

  return (
    <div
      className="mb-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/95 to-white px-4 py-4 shadow-sm"
      role="region"
      aria-label="Наступні кроки після створення ліда"
    >
      <div className="mb-3 text-center sm:text-left">
        <p className="text-base font-semibold tracking-tight text-[var(--enver-text)]">
          Що далі?
        </p>
        <p className="mt-0.5 text-xs text-slate-600">
          Лід збережено. Оберіть одну дію — решта в меню вкладок.
        </p>
      </div>

      <div
        className={cn(
          "grid gap-2",
          showSupervisorFlow
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            : "grid-cols-2 sm:grid-cols-4",
        )}
      >
        {tel ? (
          <a
            href={tel}
            onClick={clearFresh}
            className={cn(tileClass, "bg-emerald-50/80 hover:bg-emerald-100/80")}
          >
            <span className="text-lg" aria-hidden>
              📞
            </span>
            <span className="text-xs font-semibold">Подзвонити</span>
          </a>
        ) : (
          <Link
            href={`/leads/${leadId}/contact`}
            onClick={clearFresh}
            className={cn(tileClass, "border-dashed")}
          >
            <span className="text-lg" aria-hidden>
              📞
            </span>
            <span className="text-xs font-semibold">Подзвонити</span>
            <span className="text-[10px] leading-tight text-slate-500">
              Додайте номер у контакті
            </span>
          </Link>
        )}

        <Link
          href={`/leads/${leadId}/messages`}
          onClick={clearFresh}
          className={tileClass}
        >
          <span className="text-lg" aria-hidden>
            💬
          </span>
          <span className="text-xs font-semibold">Написати</span>
          <span className="text-[10px] text-slate-500">Діалог</span>
        </Link>

        {showSupervisorFlow ? (
          <Link
            href={`/leads/${leadId}#lead-assignment`}
            onClick={clearFresh}
            className={tileClass}
          >
            <span className="text-lg" aria-hidden>
              👤
            </span>
            <span className="text-xs font-semibold">Призначити</span>
            <span className="text-[10px] text-slate-500">Менеджеру</span>
          </Link>
        ) : null}

        {showSupervisorFlow ? (
          <Link
            href={`/leads/${leadId}/tasks`}
            onClick={clearFresh}
            className={tileClass}
          >
            <span className="text-lg" aria-hidden>
              ✓
            </span>
            <span className="text-xs font-semibold">Задача</span>
            <span className="text-[10px] text-slate-500">Повторний контакт</span>
          </Link>
        ) : null}

        <Link
          href={`/leads/${leadId}#lead-next-contact`}
          onClick={clearFresh}
          className={tileClass}
        >
          <span className="text-lg" aria-hidden>
            📅
          </span>
          <span className="text-xs font-semibold">Запланувати</span>
          <span className="text-[10px] text-slate-500">Дата контакту</span>
        </Link>

        <Link
          href={`/leads/${leadId}#lead-hub`}
          onClick={clearFresh}
          className={tileClass}
        >
          <span className="text-lg" aria-hidden>
            🧭
          </span>
          <span className="text-xs font-semibold">Хаб ліда</span>
          <span className="text-[10px] text-slate-500">Робочий простір</span>
        </Link>

        <Link
          href={`/leads/${leadId}#lead-convert`}
          onClick={clearFresh}
          className={tileClass}
        >
          <span className="text-lg" aria-hidden>
            🔄
          </span>
          <span className="text-xs font-semibold">В замовлення</span>
          <span className="text-[10px] text-slate-500">Конверсія</span>
        </Link>
      </div>

      <div className="mt-3 flex justify-center sm:justify-end">
        <button
          type="button"
          onClick={clearFresh}
          className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
        >
          Закрити
        </button>
      </div>
    </div>
  );
}
