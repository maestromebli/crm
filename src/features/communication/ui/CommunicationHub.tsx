"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import {
  Loader2,
  MessageCircle,
  Radio,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import type {
  CommunicationHubPayload,
  HubChannelFilter,
} from "../types/hub-dto";

const FILTER_LABEL: Record<HubChannelFilter, string> = {
  ALL: "Усі канали",
  TELEGRAM: "Telegram",
  INSTAGRAM: "Instagram",
  INTERNAL_NOTE: "Нотатки",
  CALL_LOG: "Дзвінки",
};

const STATUS_UA: Record<string, string> = {
  NEEDS_REPLY: "Потрібна відповідь",
  WAITING_CLIENT: "Очікуємо клієнта",
  COMPLETED: "Завершено",
  FOLLOW_UP_OVERDUE: "Прострочений фоллоуап",
  DORMANT: "Без руху",
};

type Props = {
  leadId?: string;
  dealId?: string;
  canPostNotes: boolean;
  onPostedInternalNote?: () => void;
};

export function CommunicationHub({
  leadId,
  dealId,
  canPostNotes,
  onPostedInternalNote,
}: Props) {
  const [hub, setHub] = useState<CommunicationHubPayload | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<HubChannelFilter>("ALL");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<"insight" | "reply" | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteErr, setNoteErr] = useState<string | null>(null);

  const q = leadId
    ? `leadId=${encodeURIComponent(leadId)}`
    : `dealId=${encodeURIComponent(dealId!)}`;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const r = await fetch(`/api/communication/hub?${q}`);
      const j = (await r.json()) as CommunicationHubPayload & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      setHub(j);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Помилка");
      setHub(null);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!hub?.threads.length) return;
    setSelectedThreadId((prev) => {
      if (prev && hub.threads.some((t) => t.id === prev)) return prev;
      return hub.threads[0]!.id;
    });
  }, [hub]);

  const threads = hub?.threads ?? [];
  const filteredThreads = useMemo(() => {
    if (filter === "ALL") return threads;
    return threads.filter((t) => t.channelType === filter);
  }, [threads, filter]);

  const messages =
    selectedThreadId && hub?.messagesByThread[selectedThreadId]
      ? hub.messagesByThread[selectedThreadId]
      : [];

  const runInsight = async () => {
    setAiBusy("insight");
    try {
      const r = await fetch("/api/communication/ai/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, dealId }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      await load();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Помилка AI");
    } finally {
      setAiBusy(null);
    }
  };

  const runReply = async (style: string) => {
    setAiBusy("reply");
    try {
      const r = await fetch("/api/communication/ai/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, dealId, style }),
      });
      const j = (await r.json()) as { text?: string; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      setReplyDraft(j.text ?? "");
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Помилка AI");
    } finally {
      setAiBusy(null);
    }
  };

  const postNote = async () => {
    if (!leadId || !canPostNotes) return;
    const text = noteDraft.trim();
    if (!text) return;
    setNoteErr(null);
    try {
      const r = await fetch(`/api/leads/${leadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: text,
          channel: "INTERNAL",
          interactionKind: "NOTE",
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      setNoteDraft("");
      onPostedInternalNote?.();
      await load();
    } catch (e) {
      setNoteErr(e instanceof Error ? e.message : "Помилка");
    }
  };

  if (loading && !hub) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Завантаження комунікацій…
      </div>
    );
  }

  if (loadErr && !hub) {
    return (
      <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {loadErr}
      </p>
    );
  }

  return (
    <div className="flex min-h-[min(720px,85vh)] flex-col gap-4 xl:flex-row">
      <aside className="w-full shrink-0 xl:w-64">
        <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Канали
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(Object.keys(FILTER_LABEL) as HubChannelFilter[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                  filter === k
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {FILTER_LABEL[k]}
              </button>
            ))}
          </div>
          <ul className="mt-3 max-h-[420px] space-y-1 overflow-y-auto">
            {filteredThreads.length === 0 ? (
              <li className="px-2 py-3 text-[11px] text-slate-500">
                Немає потоків для фільтра. Додайте записи або підключіть канал.
              </li>
            ) : (
              filteredThreads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedThreadId(t.id)}
                    className={cn(
                      "flex w-full flex-col rounded-xl px-2 py-2 text-left text-[11px] transition",
                      selectedThreadId === t.id
                        ? "bg-slate-900 text-white"
                        : "hover:bg-slate-100",
                    )}
                  >
                    <span className="font-medium">{t.title ?? t.channelType}</span>
                    <span
                      className={cn(
                        "mt-0.5 line-clamp-2 opacity-80",
                        selectedThreadId === t.id ? "text-slate-200" : "text-slate-500",
                      )}
                    >
                      {t.preview ?? "—"}
                    </span>
                    <span
                      className={cn(
                        "mt-1 flex flex-wrap gap-1",
                        selectedThreadId === t.id ? "text-slate-300" : "text-slate-400",
                      )}
                    >
                      {t.needsReply ? (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-900">
                          Відповідь
                        </span>
                      ) : null}
                      <span className="text-[10px]">
                        {STATUS_UA[t.status] ?? t.status}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <div className="flex min-h-[480px] flex-col rounded-2xl border border-slate-200 bg-[var(--enver-card)] shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <MessageCircle className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-[var(--enver-text)]">
                Потік
              </h2>
              <span className="text-[11px] text-slate-500">
                {selectedThreadId
                  ? (threads.find((x) => x.id === selectedThreadId)?.channelType ??
                    "")
                  : ""}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!aiBusy}
                onClick={() => void runInsight()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Витягнути дані з переписки
              </button>
              <button
                type="button"
                disabled={!!aiBusy}
                onClick={() => void runReply("follow_up")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Згенерувати фоллоуап
              </button>
              <button
                type="button"
                disabled={!!aiBusy}
                onClick={() => void runReply("premium")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Відповідь преміально
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <p className="text-center text-[11px] text-slate-500">
                Немає повідомлень у цьому потоці.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[92%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                    m.direction === "INBOUND"
                      ? "ml-0 mr-auto bg-slate-100 text-slate-900"
                      : m.direction === "INTERNAL"
                        ? "mx-auto border border-dashed border-slate-300 bg-amber-50/60 text-amber-950"
                        : "ml-auto mr-0 bg-slate-900 text-white",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      m.direction === "OUTBOUND" ? "text-slate-300" : "text-slate-500",
                    )}
                  >
                    {m.senderName ?? "—"} ·{" "}
                    {format(new Date(m.sentAt), "d MMM yyyy HH:mm", { locale: uk })}
                  </p>
                </div>
              ))
            )}
          </div>
          {replyDraft ? (
            <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                Чернетка відповіді
              </p>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
                rows={4}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
              />
            </div>
          ) : null}
        </div>

        {leadId && canPostNotes ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-[var(--enver-text)]">
              Внутрішня нотатка
            </h3>
            {noteErr ? (
              <p className="mt-2 text-[11px] text-rose-700">{noteErr}</p>
            ) : null}
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              placeholder="Результат дзвінка, інструкція керівника…"
              className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() => void postNote()}
              className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
              disabled={!noteDraft.trim()}
            >
              Зберегти нотатку в CRM
            </button>
          </div>
        ) : null}
      </section>

      <aside className="w-full shrink-0 space-y-3 xl:w-80">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <p className="text-xs font-semibold text-[var(--enver-text)]">
              AI: підсумок
            </p>
          </div>
          {hub?.primaryInsight?.summaryShort ? (
            <p className="mt-2 text-xs leading-relaxed text-slate-700">
              {hub.primaryInsight.summaryShort}
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-slate-500">
              Натисніть «Витягнути дані з переписки» після накопичення повідомлень.
            </p>
          )}
          {hub?.primaryInsight?.clientIntent ? (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                Що хоче клієнт
              </p>
              <p className="mt-1 text-xs text-slate-700">
                {hub.primaryInsight.clientIntent}
              </p>
            </div>
          ) : null}
          {hub?.primaryInsight?.recommendedNextStep ? (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                Наступний крок
              </p>
              <p className="mt-1 text-xs text-slate-800">
                {hub.primaryInsight.recommendedNextStep}
              </p>
            </div>
          ) : null}
          {hub?.primaryInsight?.confidenceScore != null ? (
            <p className="mt-2 text-[10px] text-slate-400">
              Впевненість моделі:{" "}
              {Math.round(hub.primaryInsight.confidenceScore * 100)}%
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Radio className="h-4 w-4" />
            <p className="text-xs font-semibold">Стан каналів</p>
          </div>
          <ul className="mt-2 space-y-2">
            {(hub?.channelHealth ?? []).map((c) => (
              <li
                key={`${c.channelType}-${c.title}`}
                className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-2 text-[11px]"
              >
                <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>
                  <span className="font-medium">{c.title}</span>
                  <span className="block text-slate-500">{c.syncStatus}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {hub && hub.followUps.length > 0 ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm">
            <p className="text-xs font-semibold text-amber-950">Фоллоуап</p>
            <ul className="mt-2 space-y-2 text-[11px] text-amber-950">
              {hub.followUps.map((f) => (
                <li key={f.id} className="rounded-lg bg-white/80 px-2 py-2">
                  {f.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {aiBusy ? (
          <p className="flex items-center gap-2 text-[11px] text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Обробка AI…
          </p>
        ) : null}
      </aside>
    </div>
  );
}
