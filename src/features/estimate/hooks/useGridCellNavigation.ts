"use client";

import { useCallback, useRef } from "react";

/**
 * Мінімальна навігація Tab між клітинками (розширюється під повну сітку).
 */
export function useGridCellNavigation(
  _columnCount: number,
  _rowCount: number,
) {
  const focusRef = useRef<HTMLElement | null>(null);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, onTabNext: () => void) => {
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        onTabNext();
      }
      if (e.key === "Escape") {
        (e.target as HTMLElement).blur();
      }
    },
    [],
  );

  return { focusRef, onKeyDown };
}
