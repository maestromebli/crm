"use client";

import { useEffect, useState } from "react";
import type { PhoneDuplicateMatch } from "../lib/leads/phone-check-matches";
import { normalizePhoneDigits } from "../lib/leads/phone-normalize";

/** Відповідь `GET /api/leads/check-phone` — плоский масив збігів. */
export type LeadPhoneDuplicateMatches = PhoneDuplicateMatch[];

const EMPTY: LeadPhoneDuplicateMatches = [];

function hasAny(m: LeadPhoneDuplicateMatches): boolean {
  return m.length > 0;
}

type UseDuplicateCheckOptions = {
  /** Затримка перед запитом, мс (за замовчуванням 300). */
  debounceMs?: number;
  /** Мінімум цифр у номері, щоб робити запит (як у NewLeadModal). */
  minDigits?: number;
};

/**
 * Live-перевірка збігів за телефоном у лідах / контактах / замовленнях.
 * Ендпоінт: `/api/leads/check-phone?phone=…`
 */
export function useDuplicateCheck(
  phone: string,
  options?: UseDuplicateCheckOptions,
) {
  const debounceMs = options?.debounceMs ?? 300;
  const minDigits = options?.minDigits ?? 8;

  const [matches, setMatches] = useState<LeadPhoneDuplicateMatches | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = phone?.trim() ?? "";
    setError(null);

    if (!trimmed) {
      setMatches(null);
      setLoading(false);
      return;
    }

    if (normalizePhoneDigits(trimmed).length < minDigits) {
      setMatches(null);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);

    const timeout = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/leads/check-phone?phone=${encodeURIComponent(trimmed)}`,
            { signal: ac.signal },
          );
          const json = (await res.json()) as {
            matches?: PhoneDuplicateMatch[];
            error?: string;
          };
          if (ac.signal.aborted) return;
          if (!res.ok) {
            setMatches(null);
            setError(json.error ?? "Помилка перевірки");
            return;
          }
          setMatches(Array.isArray(json.matches) ? json.matches : EMPTY);
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          if (!ac.signal.aborted) {
            setMatches(null);
            setError("Не вдалося перевірити номер");
          }
        } finally {
          if (!ac.signal.aborted) setLoading(false);
        }
      })();
    }, debounceMs);

    return () => {
      clearTimeout(timeout);
      ac.abort();
    };
  }, [phone, debounceMs, minDigits]);

  const duplicates = matches ?? EMPTY;

  return {
    /** Плоский список збігів (`type`, `name`, `value`, `id`, …). */
    matches: duplicates,
    /** Синонім `matches`. */
    duplicates,
    loading,
    error,
    hasDuplicates: hasAny(duplicates),
  };
}
