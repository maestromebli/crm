"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Мінімальний зріз сутності зі сторінки (лід / угода) для контексту помічника.
 * Заповнюється клієнтськими мостами на відповідних екранах.
 */
export type AssistantPageEntitySnapshot = {
  kind: "lead" | "deal";
  entityId: string;
  title: string;
  statusLabel: string | null;
  overdueTasks: number;
  staleSinceHours: number | null;
  quoteStatus: string | null;
  paymentStatus: string | null;
  missingFieldLabels: string[];
};

type Ctx = {
  snapshot: AssistantPageEntitySnapshot | null;
  setSnapshot: (v: AssistantPageEntitySnapshot | null) => void;
};

const AssistantPageEntityContext = createContext<Ctx | null>(null);

export function AssistantPageEntityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [snapshot, setSnapshotState] =
    useState<AssistantPageEntitySnapshot | null>(null);
  const setSnapshot = useCallback((v: AssistantPageEntitySnapshot | null) => {
    setSnapshotState(v);
  }, []);

  const value = useMemo(
    () => ({ snapshot, setSnapshot }),
    [snapshot, setSnapshot],
  );

  return (
    <AssistantPageEntityContext.Provider value={value}>
      {children}
    </AssistantPageEntityContext.Provider>
  );
}

export function useAssistantPageEntitySnapshot(): AssistantPageEntitySnapshot | null {
  const ctx = useContext(AssistantPageEntityContext);
  return ctx?.snapshot ?? null;
}

export function useAssistantPageEntitySetter(): (
  v: AssistantPageEntitySnapshot | null,
) => void {
  const ctx = useContext(AssistantPageEntityContext);
  return ctx?.setSnapshot ?? (() => {});
}
