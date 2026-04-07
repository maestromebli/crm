"use client";

import Link from "next/link";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LeadMetaInput } from "../../../../lib/leads/lead-row-meta";
import { leadResponseStatus } from "../../../../lib/leads/lead-row-meta";
import { cn } from "../../../../lib/utils";

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
}: Props) {
  const router = useRouter();
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

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
      const r = await fetch(`/api/leads/${leadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, interactionKind }),
      });
      const j = (await r.json()) as { error?: string; message?: Msg };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
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
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const chronological = [...msgs].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const tail = chronological.slice(-12);

  return (
    <section
      id="lead-communication"
      className="enver-card-appear rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-medium text-[var(--enver-text)]">Стрічка</h2>
          <p className="mt-0.5 text-[12px] text-[var(--enver-muted)]">
            Повідомлення, дзвінки та нотатки — як у месенджері.
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

      <div className="mt-4 flex max-h-[min(420px,55vh)] flex-col gap-2 overflow-y-auto rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-bg)] p-3">
        {tail.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-[var(--enver-muted)]">
            Поки без записів — додайте подію нижче.
          </p>
        ) : (
          tail.map((m) => (
            <div
              key={m.id}
              className="enver-hover-lift flex max-w-[95%] flex-col self-end rounded-[12px] rounded-br-sm border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-2 shadow-[var(--enver-shadow)]"
            >
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-[var(--enver-muted)]">
                <span>{kindLabel(m.interactionKind)}</span>
                <span className="font-normal normal-case text-[var(--enver-muted)]">
                  {format(new Date(m.createdAt), "d MMM HH:mm", { locale: uk })}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--enver-text)]">
                {m.body}
              </p>
              <p className="mt-1 text-[11px] text-[var(--enver-muted)]">{m.author}</p>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={!canUpdateLead || busy}
            onClick={() => void post(p.body, p.kind)}
            className="enver-press rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] px-2 py-1 text-[11px] font-medium text-[var(--enver-text-muted)] transition duration-200 hover:border-[var(--enver-border-strong)] disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          disabled={!canUpdateLead || busy}
          onClick={startInternalNote}
          className="enver-press rounded-[12px] border border-dashed border-[var(--enver-border-strong)] bg-[var(--enver-bg)] px-2 py-1 text-[11px] font-medium text-[var(--enver-muted)] hover:border-[var(--enver-muted)] disabled:opacity-50"
          title="Вставити префікс у поле нижче — допишіть текст і збережіть"
        >
          Внутрішня нотатка
        </button>
      </div>

      <textarea
        ref={draftRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        disabled={!canUpdateLead}
        placeholder="Швидка нотатка…"
        className="mt-2 w-full rounded-[12px] border border-[var(--enver-border)] px-3 py-2 text-[14px] outline-none transition duration-200 focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20"
      />
      <button
        type="button"
        disabled={!canUpdateLead || busy || !draft.trim()}
        onClick={() => void post(draft, "NOTE")}
        className="enver-press mt-2 rounded-[12px] bg-[#2563EB] px-3 py-2 text-[12px] font-medium text-white transition duration-200 hover:bg-[#1D4ED8] disabled:opacity-50"
      >
        Зберегти
      </button>

      <Link
        href={`/leads/${leadId}/messages`}
        className={cn(
          "mt-3 inline-block text-[12px] font-medium text-[var(--enver-accent)] hover:underline",
        )}
      >
        Повна стрічка →
      </Link>
    </section>
  );
}
