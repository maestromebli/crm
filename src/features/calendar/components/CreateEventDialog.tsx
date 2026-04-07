"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { X } from "lucide-react";
import { postJson } from "@/lib/api/patch-json";
import { prismaCalendarTypeOptions } from "../event-type-styles";
import type { CalendarEventType as PrismaCalendarEventType } from "@prisma/client";
import { cn } from "../../../lib/utils";
import { LocationAutocompleteInput } from "./LocationAutocompleteInput";

type Props = {
  open: boolean;
  onClose: () => void;
  /** День, на якому користувач перебуває в календарі — для дефолтного часу */
  anchorDate: Date;
};

function toLocalInput(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function CreateEventDialog({ open, onClose, anchorDate }: Props) {
  const router = useRouter();
  const [type, setType] = useState<PrismaCalendarEventType>("MEETING");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const base = new Date(anchorDate);
    base.setHours(10, 0, 0, 0);
    const end = new Date(base);
    end.setHours(base.getHours() + 1);
    setStartLocal(toLocalInput(base));
    setEndLocal(toLocalInput(end));
    setErr(null);
    setTitle("");
    setLocation("");
    setDescription("");
    setType("MEETING");
  }, [open, anchorDate]);

  const submit = useCallback(async () => {
    setErr(null);
    const t = title.trim();
    if (!t) {
      setErr("Введіть назву події");
      return;
    }
    const start = new Date(startLocal);
    const end = new Date(endLocal);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setErr("Перевірте дату та час");
      return;
    }
    if (end <= start) {
      setErr("Час завершення має бути пізніше за початок");
      return;
    }
    setSaving(true);
    try {
      await postJson<{ id?: string }>("/api/calendar/events", {
        title: t,
        type,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        location: location.trim() || null,
        description: description.trim() || null,
        isAllDay: false,
      });
      onClose();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setSaving(false);
    }
  }, [description, endLocal, location, onClose, router, startLocal, title, type]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-3 py-10 md:py-16"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-xs shadow-[0_22px_60px_rgba(15,23,42,0.35)]"
        role="dialog"
        aria-labelledby="create-event-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p
              id="create-event-title"
              className="text-sm font-semibold text-[var(--enver-text)]"
            >
              Нова подія
            </p>
            <p className="text-[11px] text-slate-500">
              Оберіть тип — кожен має свій колір у календарі
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-[var(--enver-hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {err ? (
          <p className="mb-3 rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800">
            {err}
          </p>
        ) : null}

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-600">
              Тип події
            </p>
            <div className="flex flex-col gap-2">
              {prismaCalendarTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition",
                    type === opt.value
                      ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                      : "border-slate-200 bg-[var(--enver-card)] hover:bg-[var(--enver-hover)]/80",
                  )}
                >
                  <span
                    className={cn(
                      "h-3 w-3 shrink-0 rounded-full shadow-sm",
                      opt.swatchClass,
                    )}
                  />
                  <span className="font-medium text-slate-800">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-[11px] text-slate-500">Назва</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              placeholder="Напр. Замір кухні"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] text-slate-500">Початок</span>
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500">Завершення</span>
              <input
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <div className="block">
            <span className="text-[11px] text-slate-500">
              Локація (необовʼязково) · Google Maps
            </span>
            <LocationAutocompleteInput
              id="create-event-location"
              value={location}
              onChange={setLocation}
              disabled={saving}
            />
          </div>

          <label className="block">
            <span className="text-[11px] text-slate-500">Опис (необов’язково)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-[var(--enver-hover)]"
          >
            Скасувати
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? "Створення…" : "Створити"}
          </button>
        </div>
      </div>
    </div>
  );
}
