"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, MessageSquare, Send, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import { assistantConfig } from "../config/assistantConfig";
import type { AssistantChatMessage } from "../hooks/useAssistantChat";
import type { AssistantResolvedContext, AssistantVisualState } from "../types";
import {
  getAssistantGreeting,
  getAssistantRecommendationSummary,
  getAssistantStatusLabel,
} from "../utils/assistantMessages";
import { AssistantAvatar } from "./AssistantAvatar";
import { AssistantContextCard } from "./AssistantContextCard";
import { AssistantQuickActions } from "./AssistantQuickActions";
import { AssistantChatThread } from "./AssistantChatThread";
import { AiWorkspaceBlocks } from "./AiWorkspaceBlocks";
import type { AiWorkspacePayload } from "../../ai/workspace/types";

type Props = {
  open: boolean;
  onClose: () => void;
  resolved: AssistantResolvedContext;
  visualState: AssistantVisualState;
  loading: boolean;
  error: string | null;
  messages: AssistantChatMessage[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  reducedMotion: boolean;
  zIndex: number;
  workspace: AiWorkspacePayload | null;
  workspaceLoading: boolean;
  workspaceError: string | null;
};

export function AssistantPanel({
  open,
  onClose,
  resolved,
  visualState,
  loading,
  error,
  messages,
  input,
  onInputChange,
  onSend,
  reducedMotion,
  zIndex,
  workspace,
  workspaceLoading,
  workspaceError,
}: Props) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  const greeting = getAssistantGreeting(resolved);
  const summary = getAssistantRecommendationSummary(resolved);
  const statusLabel = getAssistantStatusLabel(visualState, loading, Boolean(error));

  return (
    <div
      id="enver-assistant-panel"
      role="dialog"
      aria-modal="true"
      aria-label={assistantConfig.copy.panelTitle}
      className={cn(
        "flex max-h-[min(var(--panel-max),86vh)] w-[min(100vw-1.5rem,400px)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-[var(--enver-card)] shadow-xl shadow-slate-900/5",
        "motion-safe:transition motion-safe:duration-200 motion-safe:ease-out",
      )}
      style={
        {
          "--panel-max": `${assistantConfig.panel.maxHeightVh}vh`,
          zIndex,
          maxHeight: `min(${assistantConfig.panel.maxHeightVh}vh, 640px)`,
          width: `min(100vw - 1.5rem, ${assistantConfig.panel.widthPx}px)`,
        } as CSSProperties
      }
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100/90 bg-gradient-to-r from-slate-50/80 to-white px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <AssistantAvatar
            state={visualState}
            reducedMotion={reducedMotion}
            voiceActive={loading}
            size={36}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--enver-text)]">
              {assistantConfig.copy.panelTitle}
            </p>
            <p className="text-[10px] leading-snug text-slate-400">
              {assistantConfig.copy.panelSubtitleHint}
            </p>
            <p className="truncate text-[11px] text-slate-500">{statusLabel}</p>
          </div>
        </div>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Закрити панель помічника"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[min(240px,34vh)] shrink-0 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
        <p className="text-xs leading-snug text-slate-600">{greeting}</p>
        <AiWorkspaceBlocks
          workspace={workspace}
          loading={workspaceLoading}
          error={workspaceError}
        />
        <AssistantContextCard resolved={resolved} />
        <div className="border-l-2 border-slate-200 pl-3">
          <p className="text-xs text-slate-700">{summary}</p>
          <ul className="mt-2 space-y-2 text-xs text-slate-600">
            {resolved.recommendations.map((r) => (
              <li key={r.id}>
                <span className="font-medium text-slate-800">{r.title}</span>
                {r.description ? (
                  <span className="mt-0.5 block text-slate-600">{r.description}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {resolved.nextBestAction ? (
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-700">
              <span className="font-medium text-slate-800">Наступний крок: </span>
              {resolved.nextBestAction}
            </p>
          ) : null}
        </div>
        <div>
          <p className="mb-1.5 text-xs text-slate-500">Швидкі дії</p>
          <AssistantQuickActions actions={resolved.quickActions} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-slate-100/90 bg-gradient-to-b from-slate-50/50 to-slate-50/90">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100/80 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-violet-600 shadow-sm ring-1 ring-slate-200/80">
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {assistantConfig.copy.chatSectionTitle}
              </p>
              <p className="text-[10px] leading-tight text-slate-400">
                {assistantConfig.copy.chatThreadSubtitle}
              </p>
            </div>
          </div>
          <Link
            href={assistantConfig.copy.fullChatHref}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium text-violet-700 transition hover:bg-violet-50 hover:text-violet-600"
            onClick={onClose}
          >
            {assistantConfig.copy.openFullChat}
            <ArrowUpRight className="h-3 w-3 opacity-80" />
          </Link>
        </div>

        <AssistantChatThread
          messages={messages}
          loading={loading}
          error={error}
          emptyHint={assistantConfig.copy.chatEmptyHint}
        />
      </div>

      <div className="flex shrink-0 gap-2 border-t border-slate-100/90 bg-white/95 p-2.5 backdrop-blur-sm">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={2}
          placeholder={assistantConfig.copy.chatPlaceholder}
          className={cn(
            "min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200/90 bg-slate-50/50 px-3 py-2.5 text-[13px] leading-snug text-[var(--enver-text)] placeholder:text-slate-400",
            "outline-none transition focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-500/15",
          )}
          aria-label="Повідомлення для AI"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={loading || !input.trim()}
          className={cn(
            "group flex shrink-0 items-center justify-center self-end rounded-xl px-3 py-2.5 text-white transition",
            "bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md shadow-violet-500/25",
            "hover:brightness-105 focus-visible:outline focus-visible:ring-2 focus-visible:ring-violet-400/50",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
          )}
          aria-label="Надіслати"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5 transition group-active:translate-x-0.5" />
          )}
        </button>
      </div>
      <p className="shrink-0 px-3 pb-2.5 text-center text-[10px] text-slate-400">
        Enter — надіслати · Shift+Enter — новий рядок
      </p>
    </div>
  );
}
