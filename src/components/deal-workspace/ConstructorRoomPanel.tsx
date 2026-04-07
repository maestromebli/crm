"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dealQueryKeys } from "../../features/deal-workspace/deal-query-keys";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { patchDealConstructorRoomByDealId } from "../../features/deal-workspace/use-deal-mutation-actions";
import { cn } from "../../lib/utils";
import { qaRowParts } from "../../lib/constructor-room/qa-format";
import {
  isoToLocalDatetimeValue,
  localDatetimeValueToIso,
} from "../../lib/constructor-room/datetime-local";
import { writeTextToClipboard } from "../../lib/clipboard-write";
import { useDealWorkspaceToast } from "./DealWorkspaceToast";

const btn =
  "rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-slate-200 bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[var(--enver-hover)]";

type Room = NonNullable<DealWorkspacePayload["constructorRoom"]>;

function statusUa(s: Room["status"]): string {
  const m: Record<Room["status"], string> = {
    PENDING_ASSIGNMENT: "Очікує призначення",
    SENT_TO_CONSTRUCTOR: "Надіслано конструктору",
    IN_PROGRESS: "У роботі",
    DELIVERED: "Файл здано",
    REVIEWED: "Перевірено",
  };
  return m[s] ?? s;
}

function statusBadgeClass(s: Room["status"]): string {
  const m: Record<Room["status"], string> = {
    PENDING_ASSIGNMENT:
      "border border-slate-200 bg-slate-100 text-[var(--enver-text)]",
    SENT_TO_CONSTRUCTOR: "border border-sky-200 bg-sky-100 text-sky-950",
    IN_PROGRESS: "border border-amber-200 bg-amber-100 text-amber-950",
    DELIVERED: "border border-emerald-200 bg-emerald-100 text-emerald-950",
    REVIEWED: "border border-violet-200 bg-violet-100 text-violet-950",
  };
  return m[s] ?? "border border-slate-200 bg-slate-100 text-[var(--enver-text)]";
}

export function ConstructorRoomPanel({
  dealId,
  canUse,
  initialRoom,
}: {
  dealId: string;
  canUse: boolean;
  initialRoom: DealWorkspacePayload["constructorRoom"];
}) {
  const queryClient = useQueryClient();
  const { showToast } = useDealWorkspaceToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(initialRoom);
  const [msg, setMsg] = useState("");
  const [externalLabel, setExternalLabel] = useState(
    initialRoom?.externalConstructorLabel ?? "",
  );
  const [tgUrl, setTgUrl] = useState(initialRoom?.telegramInviteUrl ?? "");
  const [tgChat, setTgChat] = useState(initialRoom?.telegramChatId ?? "");
  const [assignUserId, setAssignUserId] = useState(
    initialRoom?.assignedUserId ?? "",
  );
  const [assignees, setAssignees] = useState<
    { id: string; name: string | null; email: string }[]
  >([]);
  const [assigneesStatus, setAssigneesStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [assigneesRetry, setAssigneesRetry] = useState(0);
  const [telegramTranscript, setTelegramTranscript] = useState("");
  const [priority, setPriority] = useState<
    "LOW" | "NORMAL" | "HIGH" | "URGENT"
  >(initialRoom?.priority ?? "NORMAL");
  const [dueAtLocal, setDueAtLocal] = useState(() =>
    isoToLocalDatetimeValue(initialRoom?.dueAt ?? null),
  );
  const [aiMode, setAiMode] = useState<null | "field" | "save">(null);
  const [aiQaText, setAiQaText] = useState(() => {
    try {
      return initialRoom?.aiQaJson
        ? JSON.stringify(initialRoom.aiQaJson, null, 2)
        : "[\n  { \"question\": \"\", \"answer\": \"\" }\n]";
    } catch {
      return "[]";
    }
  });

  const applyServerRoom = useCallback((r: Room) => {
    setRoom(r);
    setExternalLabel(r.externalConstructorLabel ?? "");
    setTgUrl(r.telegramInviteUrl ?? "");
    setTgChat(r.telegramChatId ?? "");
    setAssignUserId(r.assignedUserId ?? "");
    setPriority(r.priority ?? "NORMAL");
    setDueAtLocal(isoToLocalDatetimeValue(r.dueAt ?? null));
    try {
      setAiQaText(
        r.aiQaJson != null
          ? JSON.stringify(r.aiQaJson, null, 2)
          : "[\n  { \"question\": \"\", \"answer\": \"\" }\n]",
      );
    } catch {
      setAiQaText("[]");
    }
  }, []);

  useEffect(() => {
    if (!initialRoom) {
      setRoom(null);
      setExternalLabel("");
      setTgUrl("");
      setTgChat("");
      setAssignUserId("");
      setPriority("NORMAL");
      setDueAtLocal("");
      setAiQaText("[\n  { \"question\": \"\", \"answer\": \"\" }\n]");
      return;
    }
    applyServerRoom(initialRoom);
  }, [initialRoom, applyServerRoom]);

  useEffect(() => {
    if (!room || !canUse) return;
    let cancelled = false;
    setAssigneesStatus("loading");
    void (async () => {
      try {
        const r = await fetch(
          `/api/deals/${dealId}/constructor-room/assignees`,
        );
        const j = (await r.json()) as {
          error?: string;
          users?: { id: string; name: string | null; email: string }[];
        };
        if (!r.ok) throw new Error(j.error ?? "Помилка списку");
        if (!cancelled) {
          setAssignees(j.users ?? []);
          setAssigneesStatus("ok");
        }
      } catch {
        if (!cancelled) setAssigneesStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [room, canUse, dealId, assigneesRetry]);

  const publicPath = room ? `/c/${room.publicToken}` : "";

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setErr(null);
      try {
        await fn();
        void queryClient.invalidateQueries({
          queryKey: dealQueryKeys.workspace(dealId),
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Помилка");
      } finally {
        setBusy(false);
      }
    },
    [dealId, queryClient],
  );

  const copyLink = useCallback(async () => {
    if (!room || typeof window === "undefined") return;
    const full = `${window.location.origin}${publicPath}`;
    const ok = await writeTextToClipboard(full);
    showToast(
      ok ? "Посилання скопійовано" : "Не вдалося скопіювати",
      { tone: ok ? "success" : "warning" },
    );
  }, [publicPath, room, showToast]);

  const ensureRoom = useCallback(() => {
    void run(async () => {
      const r = await fetch(`/api/deals/${dealId}/constructor-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure" }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        room?: Room;
      };
      if (!r.ok) throw new Error(j.error ?? "Не вдалося створити кімнату");
      if (j.room) applyServerRoom(j.room);
      showToast("Кімнату конструктора створено", { tone: "success" });
    });
  }, [applyServerRoom, dealId, run, showToast]);

  const saveMeta = useCallback(() => {
    void run(async () => {
      let aiQaJson: unknown = null;
      const trimmed = aiQaText.trim();
      if (trimmed) {
        try {
          aiQaJson = JSON.parse(trimmed) as unknown;
        } catch {
          throw new Error("Q&A: некоректний JSON");
        }
      }
      const dueAtIso = localDatetimeValueToIso(dueAtLocal);
      const j = await patchDealConstructorRoomByDealId<{ room?: Room }>(dealId, {
          assignedUserId: assignUserId.trim() || null,
          externalConstructorLabel: externalLabel.trim() || null,
          telegramInviteUrl: tgUrl.trim() || null,
          telegramChatId: tgChat.trim() || null,
          aiQaJson,
          priority,
          dueAt: dueAtIso,
      });
      if (j.room) applyServerRoom(j.room);
      showToast("Збережено", { tone: "info" });
    });
  }, [
    aiQaText,
    applyServerRoom,
    assignUserId,
    dealId,
    dueAtLocal,
    externalLabel,
    priority,
    run,
    showToast,
    tgChat,
    tgUrl,
  ]);

  const generateQaFromTranscript = useCallback(
    (saveToRoom: boolean) => {
      const t = telegramTranscript.trim();
      if (!t) {
        setErr("Вставте текст переписки (Telegram).");
        return;
      }
      setAiMode(saveToRoom ? "save" : "field");
      setErr(null);
      void (async () => {
        try {
          const r = await fetch(
            `/api/deals/${dealId}/constructor-room/ai-qa`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                transcript: t,
                saveToRoom,
              }),
            },
          );
          const j = (await r.json()) as {
            error?: string;
            detail?: string;
            items?: { question: string; answer: string }[];
          };
          if (!r.ok) {
            const detail = j.detail?.trim();
            throw new Error(
              (j.error ?? "Помилка AI") +
                (detail ? `: ${detail.slice(0, 200)}` : ""),
            );
          }
          const items = j.items ?? [];
          setAiQaText(JSON.stringify(items, null, 2));
          showToast(
            saveToRoom
              ? "Q&A згенеровано та збережено в кімнаті"
              : "Q&A вставлено в поле (натисніть «Зберегти поля» для збереження)",
            { tone: "success" },
          );
          if (saveToRoom) {
            void queryClient.invalidateQueries({
              queryKey: dealQueryKeys.workspace(dealId),
            });
          }
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Помилка");
        } finally {
          setAiMode(null);
        }
      })();
    },
    [dealId, queryClient, showToast, telegramTranscript],
  );

  const sendToConstructor = useCallback(() => {
    void run(async () => {
      const j = await patchDealConstructorRoomByDealId<{ room?: Room }>(dealId, {
        sendToConstructor: true,
      });
      if (j.room) applyServerRoom(j.room);
      showToast("Завдання надіслано конструктору (посилання активне)", {
        tone: "success",
      });
    });
  }, [applyServerRoom, dealId, run, showToast]);

  const markReviewed = useCallback(() => {
    void run(async () => {
      const j = await patchDealConstructorRoomByDealId<{ room?: Room }>(dealId, {
        markReviewed: true,
      });
      if (j.room) applyServerRoom(j.room);
      showToast("Позначено як перевірено головним конструктором", {
        tone: "success",
      });
    });
  }, [applyServerRoom, dealId, run, showToast]);

  const postInternalMessage = useCallback(() => {
    const t = msg.trim();
    if (!t) return;
    void run(async () => {
      const r = await fetch(`/api/deals/${dealId}/constructor-room/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        room?: Room;
      };
      if (!r.ok) throw new Error(j.error ?? "Не надіслано");
      if (j.room) applyServerRoom(j.room);
      setMsg("");
      showToast("Повідомлення додано", { tone: "info" });
    });
  }, [applyServerRoom, dealId, msg, run, showToast]);

  const qaPreview = useMemo(() => {
    try {
      const parsed = JSON.parse(aiQaText) as unknown;
      if (Array.isArray(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  }, [aiQaText]);

  const assigneeMissingInList =
    Boolean(assignUserId) &&
    assigneesStatus === "ok" &&
    !assignees.some((u) => u.id === assignUserId);

  const dueIso = localDatetimeValueToIso(dueAtLocal);
  const dueDate = dueIso ? new Date(dueIso) : null;
  const slaOverdue =
    room &&
    dueDate &&
    dueDate.getTime() < Date.now() &&
    room.status !== "REVIEWED" &&
    room.status !== "DELIVERED";

  if (!canUse) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600">
        <p className="font-medium text-slate-800">Кімната конструктора</p>
        <p className="mt-1">
          Доступна після прийнятої передачі та успішного запуску у виробництво.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 text-xs">
      <div>
        <h3 className="text-sm font-semibold text-[var(--enver-text)]">
          Кімната конструктора (віддалена робота)
        </h3>
        <p className="mt-1 text-slate-600">
          Директор виробництва призначає внутрішнього конструктора (за потреби)
          і надсилає посилання зовнішньому виконавцю. Текст з Telegram можна
          вставити нижче і згенерувати Q&A через AI (потрібен AI_API_KEY).
        </p>
        <p className="mt-2">
          <Link
            href="/production/constructor"
            className="font-medium text-indigo-700 underline hover:text-indigo-900"
          >
            Борд усіх конструкторів (виробництво)
          </Link>
        </p>
      </div>

      {!room ? (
        <button
          type="button"
          disabled={busy}
          className={btn}
          onClick={() => ensureRoom()}
        >
          Створити кімнату конструктора
        </button>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium shadow-sm",
                statusBadgeClass(room.status),
              )}
            >
              {statusUa(room.status)}
            </span>
            <button
              type="button"
              className={btnGhost}
              disabled={busy}
              onClick={() => void copyLink()}
            >
              Копіювати посилання
            </button>
            <a
              href={publicPath}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-700 underline"
            >
              Відкрити сторінку конструктора
            </a>
          </div>

          {err ? (
            <p className="rounded-lg bg-rose-50 px-2 py-1 text-rose-800">
              {err}
            </p>
          ) : null}

          {slaOverdue ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-900">
              <span className="font-semibold">SLA:</span> минув дедлайн здачі (
              {dueDate?.toLocaleString("uk-UA")}). Звʼяжіться з конструктором або
              оновіть дату.
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-slate-500">Пріоритет</span>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(
                    e.target.value as "LOW" | "NORMAL" | "HIGH" | "URGENT",
                  )
                }
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
              >
                <option value="LOW">Низький</option>
                <option value="NORMAL">Звичайний</option>
                <option value="HIGH">Високий</option>
                <option value="URGENT">Терміново</option>
              </select>
            </label>
            <label className="block">
              <span className="text-slate-500">Дедлайн здачі (креслення / модель)</span>
              <input
                type="datetime-local"
                value={dueAtLocal}
                onChange={(e) => setDueAtLocal(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-slate-500">
                Внутрішній конструктор (обліковий запис)
              </span>
              <select
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
                disabled={assigneesStatus === "loading"}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 disabled:opacity-60"
              >
                <option value="">— Не обрано (лише зовнішній) —</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name?.trim() ? u.name : u.email}
                  </option>
                ))}
              </select>
              {assigneesStatus === "loading" ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  Завантаження списку…
                </p>
              ) : null}
              {assigneesStatus === "error" ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-[11px] text-rose-700">
                    Не вдалося завантажити список користувачів.
                  </p>
                  <button
                    type="button"
                    className="text-[11px] text-indigo-700 underline"
                    onClick={() => setAssigneesRetry((n) => n + 1)}
                  >
                    Повторити
                  </button>
                </div>
              ) : null}
              {assigneeMissingInList ? (
                <p className="mt-1 text-[11px] text-amber-800">
                  Призначений користувач недоступний у вашому списку (змініть
                  вибір або збережіть поля після оновлення доступу).
                </p>
              ) : null}
            </label>
            <label className="block sm:col-span-2">
              <span className="text-slate-500">Конструктор (підпис для зовнішнього)</span>
              <input
                value={externalLabel}
                onChange={(e) => setExternalLabel(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                placeholder="Напр. Олександр · Telegram @nick"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-slate-500">Запрошення в Telegram-групу (URL)</span>
              <input
                value={tgUrl}
                onChange={(e) => setTgUrl(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                placeholder="https://t.me/+..."
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-slate-500">Chat ID (опційно, для інтеграцій)</span>
              <input
                value={tgChat}
                onChange={(e) => setTgChat(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
              />
            </label>
          </div>

          <div>
            <span className="text-slate-500">
              Текст переписки з Telegram (для AI)
            </span>
            <textarea
              value={telegramTranscript}
              onChange={(e) => setTelegramTranscript(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
              placeholder="Вставте експорт чату або фрагмент переписки…"
              maxLength={100_000}
            />
            <p className="mt-0.5 text-[11px] text-slate-500">
              {telegramTranscript.length.toLocaleString("uk-UA")} / 100 000
              символів
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={aiMode !== null || busy}
                className={btnGhost}
                onClick={() => generateQaFromTranscript(false)}
              >
                {aiMode === "field" ? "Генерація…" : "Згенерувати Q&A (у поле)"}
              </button>
              <button
                type="button"
                disabled={aiMode !== null || busy}
                className={btn}
                onClick={() => generateQaFromTranscript(true)}
              >
                {aiMode === "save"
                  ? "Збереження…"
                  : "Згенерувати і зберегти в кімнаті"}
              </button>
            </div>
          </div>

          <div>
            <span className="text-slate-500">
              Питання та відповіді (JSON-масив)
            </span>
            <textarea
              value={aiQaText}
              onChange={(e) => setAiQaText(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 font-mono text-[11px]"
            />
            {qaPreview ? (
              <ul className="mt-2 space-y-1 rounded border border-slate-100 bg-[var(--enver-card)] p-2">
                {qaPreview.map((row: unknown, i: number) => {
                  const { question, answer } = qaRowParts(row);
                  return (
                    <li key={i} className="text-[11px] text-slate-700">
                      <span className="font-medium text-[var(--enver-text)]">
                        {question || "—"}
                      </span>
                      <div className="text-slate-600">{answer}</div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className={btnGhost}
              onClick={() => saveMeta()}
            >
              Зберегти поля
            </button>
            <button
              type="button"
              disabled={
                busy ||
                (room.status !== "PENDING_ASSIGNMENT" &&
                  room.status !== "SENT_TO_CONSTRUCTOR")
              }
              className={btn}
              onClick={() => sendToConstructor()}
            >
              Надіслати в роботу конструктору
            </button>
            <button
              type="button"
              disabled={busy || room.status !== "DELIVERED"}
              className={cn(btnGhost, "border-emerald-300 text-emerald-800")}
              onClick={() => markReviewed()}
            >
              Позначити перевірено (головний конструктор)
            </button>
          </div>

          <div className="border-t border-indigo-100 pt-3">
            <p className="font-medium text-slate-800">Внутрішня переписка</p>
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded border border-slate-100 bg-[var(--enver-card)] p-2">
              {room.messages.map((m) => (
                <li key={m.id} className="text-[11px]">
                  <span className="text-slate-400">
                    {new Date(m.createdAt).toLocaleString("uk-UA")} ·{" "}
                    {m.authorLabel}
                  </span>
                  <div className="whitespace-pre-wrap text-slate-800">
                    {m.body}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={2}
                className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1.5"
                placeholder="Повідомлення для конструктора (від команди)…"
              />
              <button
                type="button"
                disabled={busy || !msg.trim()}
                className={btn}
                onClick={() => postInternalMessage()}
              >
                Надіслати
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
