"use client";

import { useEffect, useRef } from "react";

export function useDealAutosave(onSave: () => Promise<void> | void, delayMs = 900) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return {
    scheduleSave() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void onSave();
      }, delayMs);
    },
    cancelSave() {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
    },
  };
}

export function useDealAutosaveCleanup(cancel: () => void) {
  useEffect(() => cancel, [cancel]);
}
