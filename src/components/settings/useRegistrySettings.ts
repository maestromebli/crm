"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SetData<T> = (value: T | ((prev: T) => T)) => void;

type UseRegistrySettingsResult<T> = {
  data: T;
  setData: SetData<T>;
  saving: boolean;
  savedAt: Date | null;
  error: string | null;
  save: () => Promise<void>;
};

export function useRegistrySettings<T extends Record<string, unknown>>(
  key: string,
  defaults: T,
): UseRegistrySettingsResult<T> {
  const storageKey = useMemo(() => `enver_settings_${key}`, [key]);
  const [data, setDataState] = useState<T>(defaults);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<T>;
      setDataState((prev) => ({ ...prev, ...parsed }));
    } catch {
      setError("Не вдалося прочитати локальні налаштування.");
    }
  }, [storageKey]);

  const setData = useCallback<SetData<T>>((value) => {
    setDataState((prev) => (typeof value === "function" ? (value as (p: T) => T)(prev) : value));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      if (typeof window === "undefined") {
        throw new Error("Збереження доступне лише у браузері.");
      }
      window.localStorage.setItem(storageKey, JSON.stringify(data));
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося зберегти налаштування.");
    } finally {
      setSaving(false);
    }
  }, [data, storageKey]);

  return { data, setData, saving, savedAt, error, save };
}
