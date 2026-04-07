"use client";

import { useCallback, useState } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Copy, Download, Share2 } from "lucide-react";
import type { CalendarEvent } from "../types";
import { buildCalendarIcs, suggestedIcsFileName } from "../ics";
import { cn } from "../../../lib/utils";

type Props = {
  event: CalendarEvent;
};

function buildInvitationText(event: CalendarEvent, recipientName: string) {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const when = `${format(start, "d MMMM yyyy, HH:mm", { locale: uk })} — ${format(end, "HH:mm", { locale: uk })}`;
  const name = recipientName.trim();
  const greeting = name ? `Привіт, ${name}!` : "Привіт!";
  return `${greeting}

Запрошую на подію «${event.title}».
🗓 ${when}${event.location ? `\n📍 ${event.location}` : ""}

У вкладенні (або окремо) файл .ics — відкрий його на телефоні чи ПК, щоб додати подію до свого календаря (Google, Apple, Outlook тощо).

Надіслано з ENVER CRM.`;
}

export function EventDetailsShare({ event }: Props) {
  const [recipientName, setRecipientName] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const makeIcsBlob = useCallback(() => {
    const body = buildCalendarIcs(event);
    return new Blob([body], {
      type: "text/calendar;charset=utf-8",
    });
  }, [event]);

  const makeIcsFile = useCallback(() => {
    const body = buildCalendarIcs(event);
    return new File([body], suggestedIcsFileName(event), {
      type: "text/calendar",
    });
  }, [event]);

  const downloadIcs = useCallback(() => {
    const blob = makeIcsBlob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = suggestedIcsFileName(event);
    a.click();
    URL.revokeObjectURL(a.href);
  }, [event, makeIcsBlob]);

  const share = useCallback(async () => {
    setHint(null);
    setBusy(true);
    const text = buildInvitationText(event, recipientName);
    const file = makeIcsFile();

    try {
      const withFiles =
        typeof navigator !== "undefined" &&
        navigator.canShare?.({ files: [file] }) === true;

      if (typeof navigator !== "undefined" && navigator.share) {
        if (withFiles) {
          await navigator.share({
            title: event.title,
            text,
            files: [file],
          });
          setHint("Поділювано. Одержувач відкриває .ics і додає подію в календар.");
        } else {
          await navigator.share({
            title: event.title,
            text: `${text}\n\nЯкщо файл не прикріпився — натисни «Завантажити .ics» у календарі CRM і додай його вручну.`,
          });
          downloadIcs();
          setHint("Текст надіслано; файл .ics також збережено — прикріпи його до чату, якщо потрібно.");
        }
        return;
      }

      downloadIcs();
      setHint("Завантажено файл .ics — прикріпи його в Telegram, Viber, WhatsApp тощо. За потреби скопіюй текст кнопкою нижче.");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      downloadIcs();
      setHint("Не вдалося відкрити вікно «Поділитися». Файл .ics збережено — додай його до повідомлення вручну.");
    } finally {
      setBusy(false);
    }
  }, [downloadIcs, event, makeIcsFile, recipientName]);

  const copyInvitation = useCallback(async () => {
    const text = buildInvitationText(event, recipientName);
    try {
      await navigator.clipboard.writeText(text);
      setHint("Текст запрошення скопійовано. Встав у чат і додай файл .ics (кнопка «Завантажити»).");
    } catch {
      setHint("Не вдалося скопіювати. Виділи текст уручну або завантаж .ics.");
    }
  }, [event, recipientName]);

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2.5 text-[11px] text-slate-700 shadow-sm">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
        Поділитися в месенджері
      </p>
      <p className="mb-2 text-[11px] leading-snug text-slate-600">
        Одержувач відкриває вкладений файл{" "}
        <span className="font-medium">.ics</span> — телефон або ПК запропонує
        додати подію в календар.
      </p>

      <label className="mb-2 block">
        <span className="mb-0.5 block text-[10px] text-slate-500">
          Імʼя одержувача (необовʼязково — для привітання в тексті)
        </span>
        <input
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="Напр. Олена"
          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void share()}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-medium text-white shadow-sm hover:bg-slate-800 min-[380px]:flex-none",
            busy && "opacity-60",
          )}
        >
          <Share2 className="h-3.5 w-3.5" />
          Поділитися…
        </button>
        <button
          type="button"
          onClick={downloadIcs}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-800 hover:bg-slate-100"
        >
          <Download className="h-3.5 w-3.5" />
          .ics
        </button>
        <button
          type="button"
          onClick={() => void copyInvitation()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-[var(--enver-hover)]"
        >
          <Copy className="h-3.5 w-3.5" />
          Текст
        </button>
      </div>

      {hint ? (
        <p className="mt-2 rounded-lg bg-emerald-50/90 px-2 py-1.5 text-[11px] text-emerald-900">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
