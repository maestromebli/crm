"use client";

import Link from "next/link";
import { format, isToday, isYesterday } from "date-fns";
import { uk } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "../../../../lib/api/patch-json";
import type { LeadMetaInput } from "../../../../lib/leads/lead-row-meta";
import { leadResponseStatus } from "../../../../lib/leads/lead-row-meta";
import { cn } from "../../../../lib/utils";
import { useLeadWorkspaceSlice } from "../../../../stores/lead-workspace-store";

type Msg = {
  id: string;
  body: string;
  channel: string;
  interactionKind: string;
  createdAt: string;
  author: string;
};

type Props = {
  leadId: string;
  canUpdateLead: boolean;
  lastActivityAt: Date | null;
  nextStep: string | null;
  nextContactAt: Date | null;
  phone: string | null;
  createdAt: Date;
  stage: LeadMetaInput["stage"];
  onScheduleMeasure?: () => void;
};

type LeadMessageUpsertResponse = {
  error?: string;
  message?: Msg;
};

const PRESETS: { label: string; body: string; kind: string }[] = [
  { label: "Дзвінок (немає відповіді)", body: "Дзвінок — немає відповіді", kind: "CALL" },
  { label: "Дзвінок (розмова)", body: "Дзвінок — розмова з клієнтом", kind: "CALL" },
  { label: "Повідомлення надіслано", body: "Надіслано повідомлення клієнту", kind: "MESSAGE" },
  { label: "Очікуємо відповідь", body: "Очікуємо відповідь клієнта", kind: "NOTE" },
  { label: "КП надіслано", body: "Надіслано комерційну пропозицію", kind: "NOTE" },
  { label: "Замір узгоджено", body: "Узгоджено виїзд / замір", kind: "NOTE" },
];

const INTERNAL_NOTE_PREFIX = "Внутрішня нотатка: ";

function kindLabel(kind: string): string {
  const k = kind.toUpperCase();
  if (k === "CALL") return "Дзвінок";
  if (k === "MESSAGE") return "Повідомлення";
  return "Подія";
}

export function LeadCommunicationCard({
  leadId,
  canUpdateLead,
  lastActivityAt,
  nextStep,
  nextContactAt,
  phone,
  createdAt,
  stage,
  onScheduleMeasure,
}: Props) {
  const router = useRouter();
  const { setLastEvent } = useLeadWorkspaceSlice(leadId);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [inlineOpen, setInlineOpen] = useState<"call" | "note" | null>(null);

  const startInternalNote = () => {
    setDraft((d) => {
      const t = d.trim();
      return t ? `${t}\n${INTERNAL_NOTE_PREFIX}` : INTERNAL_NOTE_PREFIX;
    });
    queueMicrotask(() => draftRef.current?.focus());
  };

  const meta: LeadMetaInput = {
    id: leadId,
    phone,
    nextStep,
    nextContactAt,
    lastActivityAt,
    createdAt,
    stage,
  };
  const response = leadResponseStatus(meta);

  const load = useCallback(async () => {
    const r = await fetch(`/api/leads/${leadId}/messages`);
    const j = (await r.json()) as { items?: Msg[] };
    if (r.ok) setMsgs(j.items ?? []);
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: string, interactionKind: string) => {
    const text = body.trim();
    if (!text || !canUpdateLead) return;
    setBusy(true);
    try {
      const j = (await postJson(
        `/api/leads/${leadId}/messages`,
        { body: text, interactionKind },
      )) as LeadMessageUpsertResponse;
      setDraft("");
      if (j.message) {
        setMsgs((prev) => [
          ...prev,
          {
            id: j.message.id,
            body: j.message.body,
            channel: j.message.channel,
            interactionKind: j.message.interactionKind ?? "NOTE",
            createdAt: j.message.createdAt,
            author: j.message.author ?? "Ви",
          },
        ]);
      } else void load();
      setLastEvent("lead.message.posted");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setInlineOpen(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const chronological = [...msgs].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const tail = chronological.slice(-12);
  const grouped = tail.reduce<Record<string, Msg[]>>((acc, msg) => {
    const dt = new Date(msg.createdAt);
    const key = isToday(dt) ? "Сьогодні" : isYesterday(dt) ? "Вчора" : format(dt, "d MMM yyyy", { locale: uk });
    if (!acc[key]) acc[key] = [];
    acc[key].push(msg);
    return acc;
  }, {});

  return (
    <section
      id="lead-communication"
      className="enver-card-appear leadhub-card px-5 py-4"
    >
      <div className="leadhub-head">
        <div>
          <span className="leadhub-kicker">Communication</span>
          <h2 className="leadhub-title mt-1">Комунікаційний центр</h2>
          <p className="leadhub-subtitle">
            Дзвінки, повідомлення та події — єдиний потік для сканування.
          </p>
        </div>
        <p className="text-[12px] text-[var(--enver-muted)]">
          Статус:{" "}
          <span className="font-medium text-[var(--enver-text)]">{response.label}</span>
          {lastActivityAt
            ? ` · дотик ${format(new Date(lastActivityAt), "d MMM HH:mm", { locale: uk })}`
            : ""}
        </p>
      </div>

      <div className="mt-4 flex max-h-[min(420px,55vh)] flex-col gap-3 overflow-y-auto rounded-[10px] bg-[var(--enver-card)]/55 p-3">
        {tail.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-[var(--enver-muted)]">
            Поки без записів — додайте подію нижче.
            {" "}
            <Link
              href={`/leads/${leadId}/messages`}
              className="font-medium text-[var(--enver-accent)] transition duration-200 hover:underline"
            >
              Відкрити стрічку
            </Link>
          </p>
        ) : (
          Object.entries(grouped).map(([groupTitle, items]) => (
            <div key={groupTitle} className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--enver-muted)]">
                {groupTitle}
              </p>
              {items.map((m) => (
                <div
                  key={m.id}
                  className="leadhub-list-item flex max-w-[96%] flex-col rounded-[10px] px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-[var(--enver-muted)]">
                    <span>{kindLabel(m.interactionKind)}</span>
                    <span className="font-normal normal-case text-[var(--enver-muted)]">
                      {format(new Date(m.createdAt), "HH:mm", { locale: uk })}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--enver-text)]">
                    {m.body}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--enver-muted)]">{m.author}</p>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1">
        <button
          type="button"
          className="leadhub-btn rounded-[10px] px-2 py-1 text-[11px] transition duration-200"
          onClick={() => setInlineOpen((v) => (v === "call" ? null : "call"))}
        >
          Швидкий дзвінок
        </button>
        <button
          type="button"
          className="leadhub-btn rounded-[10px] px-2 py-1 text-[11px] transition duration-200"
          onClick={() => {
            setInlineOpen((v) => (v === "note" ? null : "note"));
            queueMicrotask(() => draftRef.current?.focus());
          }}
        >
          Швидка нотатка
        </button>
        <button
          type="button"
          className="leadhub-btn rounded-[10px] px-2 py-1 text-[11px] transition duration-200"
          onClick={() => onScheduleMeasure?.()}
        >
          Швидкий замір
        </button>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={!canUpdateLead || busy}
            onClick={() => void post(p.body, p.kind)}
            className="leadhub-btn enver-press rounded-[12px] px-2 py-1 text-[11px] font-medium text-[var(--enver-text-muted)] disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          disabled={!canUpdateLead || busy}
          onClick={startInternalNote}
          className="leadhub-btn enver-press rounded-[12px] border-dashed px-2 py-1 text-[11px] font-medium text-[var(--enver-muted)] disabled:opacity-50"
        >
          Внутрішня нотатка
        </button>
      </div>

      {inlineOpen === "call" ? (
        <div className="mt-2 rounded-[10px] bg-[var(--enver-bg)]/70 px-3 py-2 text-[12px] text-[var(--enver-text)]">
          {phone ? (
            <div className="flex items-center justify-between gap-2">
              <span>Готово до дзвінка: {phone}</span>
              <a href={`tel:${phone.replace(/\s+/g, "")}`} className="leadhub-inline-link">
                Подзвонити
              </a>
            </div>
          ) : (
            <span>У контакту немає номера телефону.</span>
          )}
        </div>
      ) : null}

      {inlineOpen === "note" ? (
        <div className="mt-2 rounded-[10px] bg-[var(--enver-bg)]/70 px-3 py-2 text-[12px] text-[var(--enver-muted)]">
          Введіть нотатку та натисніть Enter (або кнопку збереження).
        </div>
      ) : null}

      <textarea
        ref={draftRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (draft.trim() && canUpdateLead && !busy) {
              void post(draft, "NOTE");
            }
          }
          if (event.key === "Escape") {
            setInlineOpen(null);
          }
        }}
        rows={2}
        disabled={!canUpdateLead}
        placeholder="Швидка нотатка…"
        className="mt-2 w-full rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)]/90 px-3 py-2 text-[14px] outline-none transition duration-200 focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20"
      />
      <button
        type="button"
        disabled={!canUpdateLead || busy || !draft.trim()}
        onClick={() => void post(draft, "NOTE")}
        className="leadhub-btn leadhub-btn-primary enver-press mt-2 rounded-[12px] px-3 py-2 text-[12px] font-medium transition duration-200 disabled:opacity-50"
      >
        Зберегти
      </button>

      <Link
        href={`/leads/${leadId}/messages`}
        className={cn("leadhub-inline-link mt-3 inline-block")}
      >
        Повна стрічка →
      </Link>
    </section>
  );
}
