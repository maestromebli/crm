"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "../../lib/utils";

export type DealWorkspaceToastTone = "success" | "info" | "warning";

export type DealWorkspaceShowToastOptions = {
  tone?: DealWorkspaceToastTone;
  /** Defaults to 2400ms */
  durationMs?: number;
  onDismiss?: () => void;
};

type Ctx = {
  showToast: (message: string, options?: DealWorkspaceShowToastOptions) => void;
};

const DealWorkspaceToastContext = createContext<Ctx | null>(null);

export function useDealWorkspaceToast(): Ctx {
  const v = useContext(DealWorkspaceToastContext);
  if (!v) {
    throw new Error("useDealWorkspaceToast must be used within DealWorkspaceToastProvider");
  }
  return v;
}

/** For rare cases (tests / isolated render) without the shell provider. */
export function useDealWorkspaceToastOptional(): Ctx | null {
  return useContext(DealWorkspaceToastContext);
}

const toneClass: Record<DealWorkspaceToastTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
};

const barTrackClass: Record<DealWorkspaceToastTone, string> = {
  success: "bg-emerald-100",
  info: "bg-blue-100",
  warning: "bg-amber-100",
};

const barFillClass: Record<DealWorkspaceToastTone, string> = {
  success: "bg-emerald-500",
  info: "bg-blue-500",
  warning: "bg-amber-500",
};

export function DealWorkspaceToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<DealWorkspaceToastTone>("success");
  const [progress, setProgress] = useState(0);
  const [durationMs, setDurationMs] = useState(2400);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDismissRef = useRef<(() => void) | undefined>(undefined);

  const clearTimers = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (kickTimerRef.current) {
      clearTimeout(kickTimerRef.current);
      kickTimerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (msg: string, options?: DealWorkspaceShowToastOptions) => {
      clearTimers();
      pendingDismissRef.current?.();
      pendingDismissRef.current = options?.onDismiss;

      const d = options?.durationMs ?? 2400;
      setTone(options?.tone ?? "success");
      setDurationMs(d);
      setMessage(msg);
      setProgress(100);

      kickTimerRef.current = setTimeout(() => setProgress(0), 20);
      dismissTimerRef.current = setTimeout(() => {
        pendingDismissRef.current?.();
        pendingDismissRef.current = undefined;
        setMessage(null);
        setProgress(0);
        dismissTimerRef.current = null;
      }, d);
    },
    [clearTimers],
  );

  useEffect(() => () => clearTimers(), [clearTimers]);

  const value: Ctx = { showToast };

  return (
    <DealWorkspaceToastContext.Provider value={value}>
      {children}
      {message ? (
        <div
          className="pointer-events-none fixed bottom-24 left-1/2 z-[60] w-[min(92vw,28rem)] -translate-x-1/2 px-2"
          role="status"
          aria-live="polite"
        >
          <div
            className={cn(
              "pointer-events-auto overflow-hidden rounded-lg border px-3 py-2 text-xs shadow-lg",
              toneClass[tone],
            )}
          >
            {message}
            <div className={cn("mt-1.5 h-1 w-full rounded", barTrackClass[tone])}>
              <div
                className={cn("h-1 rounded transition-[width] ease-linear", barFillClass[tone])}
                style={{
                  width: `${progress}%`,
                  transitionDuration: `${durationMs}ms`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </DealWorkspaceToastContext.Provider>
  );
}
