"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useSession } from "next-auth/react";
import { cn } from "../../../lib/utils";
import { assistantConfig } from "../config/assistantConfig";
import { useAssistantChat } from "../hooks/useAssistantChat";
import { useAssistantContext } from "../hooks/useAssistantContext";
import { useAssistantState } from "../hooks/useAssistantState";
import type { AssistantResolvedContext } from "../types";
import { getAssistantTooltip } from "../utils/assistantMessages";
import { AssistantAvatar } from "./AssistantAvatar";
import { AssistantPanel } from "./AssistantPanel";
import { useAiWorkspace } from "../hooks/useAiWorkspace";

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

function useTabVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return visible;
}

function useFallbackResolved(
  pathname: string,
): AssistantResolvedContext {
  return useMemo(
    (): AssistantResolvedContext => ({
      role: "UNKNOWN",
      contextKind: "unknown",
      route: pathname,
      missingFields: [],
      overdueTasks: 0,
      recommendationCount: 0,
      recommendations: [],
      quickActions: [],
    }),
    [pathname],
  );
}

/**
 * Плаваючий помічник: FAB + панель + чат. Монтується в CRM shell (наприклад DashboardShell).
 */
export function AssistantWidget() {
  const { data: session } = useSession();
  const { pathname, page, sessionSlice, resolved, hidden } =
    useAssistantContext();
  const fallbackResolved = useFallbackResolved(pathname);
  const effectiveResolved = resolved ?? fallbackResolved;

  const { messages, loading, error, send, clearMessages } = useAssistantChat({
    persistUserId: session?.user?.id ?? null,
  });
  const [open, setOpen] = useState(false);
  const {
    workspace,
    loading: workspaceLoading,
    error: workspaceError,
  } = useAiWorkspace({
    page,
    enabled: Boolean(sessionSlice) && !hidden,
    panelOpen: open,
  });
  const [input, setInput] = useState("");
  const reducedMotion = usePrefersReducedMotion();
  const tabVisible = useTabVisible();

  const { visualState, badgeCount } = useAssistantState({
    resolved: effectiveResolved,
    loading: hidden ? false : loading,
    hasError: Boolean(error),
    tabVisible,
    panelOpen: open && !hidden,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onSend = useCallback(() => {
    void send(input, () => setInput(""));
  }, [input, send]);

  const tooltipText = useMemo(
    () => getAssistantTooltip(effectiveResolved),
    [effectiveResolved],
  );

  if (hidden || !sessionSlice || !resolved) return null;

  const zi = assistantConfig.widget.zIndex;
  const fabSize = assistantConfig.widget.sizePx;

  return (
    <Tooltip.Provider delayDuration={200}>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 flex justify-end p-3 sm:p-4"
        style={{ zIndex: zi }}
      >
        <div
          className="pointer-events-auto flex max-w-[100vw] flex-col items-end gap-3"
          style={{
            paddingRight: assistantConfig.widget.offsetRight - 12,
            paddingBottom: assistantConfig.widget.offsetBottom - 12,
          }}
        >
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div
                key="assistant-floating-panel"
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: 6 }}
                transition={{
                  duration: reducedMotion ? 0 : 0.18,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex max-w-[100vw] flex-col items-end"
              >
                <AssistantPanel
                  open
                  onClose={() => setOpen(false)}
                  resolved={resolved}
                  visualState={visualState}
                  loading={loading}
                  error={error}
                  messages={messages}
                  input={input}
                  onInputChange={setInput}
                  onSend={() => void onSend()}
                  reducedMotion={reducedMotion}
                  zIndex={zi}
                  workspace={workspace}
                  workspaceLoading={workspaceLoading}
                  workspaceError={workspaceError}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="flex items-center gap-2">
            {open ? (
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                }}
                className="pointer-events-auto rounded-full border border-slate-200 bg-[var(--enver-card)]/95 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-md backdrop-blur hover:bg-[var(--enver-hover)]"
              >
                Очистити діалог
              </button>
            ) : null}
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <motion.button
                  type="button"
                  onClick={() => setOpen((o) => !o)}
                  initial={
                    reducedMotion
                      ? false
                      : { scale: 0.35, rotate: -16, y: 24, x: 10, opacity: 0.85 }
                  }
                  animate={{ scale: 1, rotate: 0, y: 0, x: 0, opacity: 1 }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : {
                          type: "spring",
                          stiffness: 380,
                          damping: 20,
                          mass: 0.62,
                        }
                  }
                  whileHover={
                    reducedMotion ? undefined : { scale: 1.05, y: -1 }
                  }
                  whileTap={reducedMotion ? undefined : { scale: 0.94 }}
                  className={cn(
                    "relative flex items-center justify-center rounded-full border border-slate-300/90 bg-slate-900 p-0.5 shadow-md transition-colors hover:border-slate-400 focus-visible:outline focus-visible:ring-2 focus-visible:ring-slate-400",
                  )}
                  style={{ width: fabSize, height: fabSize, zIndex: zi }}
                  aria-expanded={open}
                  aria-controls="enver-assistant-panel"
                  aria-label={
                    open
                      ? "Згорнути помічника ENVER"
                      : `${assistantConfig.copy.tooltipOpen}. ${tooltipText}`
                  }
                >
                  {!open && badgeCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 z-10 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white shadow">
                      {badgeCount >= 9 ? "9+" : badgeCount}
                    </span>
                  ) : null}
                  <AssistantAvatar
                    state={visualState}
                    reducedMotion={reducedMotion}
                    voiceActive={loading}
                    size="md"
                    appearance={{
                      stubbleOpacity:
                        assistantConfig.appearance.stubbleOpacity,
                      smileIntensity: assistantConfig.appearance.smileIntensity,
                      eyeSize: assistantConfig.appearance.eyeSize,
                      skinTone: assistantConfig.appearance.skinTone,
                      skinToneShadow: assistantConfig.appearance.skinToneShadow,
                      motionIntensity:
                        assistantConfig.appearance.motionIntensity,
                    }}
                    className="!rounded-full"
                  />
                  <span className="sr-only">{tooltipText}</span>
                </motion.button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="z-[200] max-w-[240px] rounded-md border border-slate-200 bg-[var(--enver-card)] px-2.5 py-1.5 text-xs text-slate-700 shadow-md"
                  sideOffset={8}
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>{tooltipText}</span>
                  </span>
                  <Tooltip.Arrow className="fill-white" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
