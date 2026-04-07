"use client";

import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../../../lib/utils";

type Msg = {
  id: string;
  body: string;
  interactionKind: string;
  createdAt: string;
  author: string;
};

type Props = {
  leadId: string;
  canUpdateLead: boolean;
};

export function LeadHubNotesCard({ leadId, canUpdateLead }: Props) {
  const router = useRouter();
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/leads/${leadId}/messages`);
    const j = (await r.json()) as { items?: Msg[] };
    if (!r.ok) return;
    const all = j.items ?? [];
    const notes = all.filter((m) => {
      const k = (m.interactionKind ?? "").toUpperCase();
      return k === "NOTE" || k === "COMMENT";
    });
    setMsgs(notes.slice(-40));
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async () => {
    const text = draft.trim();
    if (!text || !canUpdateLead) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/leads/${leadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, interactionKind: "NOTE" }),
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

  return (
    <section
      id="lead-notes"
      className="rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]"
    >
      <div>
        <h2 className="text-[16px] font-semibold text-[var(--enver-text)]">
          Нотатки
        </h2>
        <p className="mt-0.5 text-[12px] text-[var(--enver-muted)]">
          Внутрішні записи команди (не змішуються зі стрічкою дзвінків).
        </p>
      </div>

      <div className="mt-4 flex max-h-[min(380px,50vh)] flex-col gap-2 overflow-y-auto rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-bg)] p-3">
        {chronological.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-[var(--enver-muted)]">
            Нотаток ще немає.
          </p>
        ) : (
          chronological.map((m) => (
            <article
              key={m.id}
              className="rounded-[10px] border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-2.5 shadow-sm"
            >
              <p className="text-[10px] text-[var(--enver-muted)]">
                {format(new Date(m.createdAt), "d MMM yyyy, HH:mm", { locale: uk })}{" "}
                · {m.author}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--enver-text)]">
                {m.body}
              </p>
            </article>
          ))
        )}
      </div>

      <textarea
        ref={draftRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        disabled={!canUpdateLead}
        placeholder="Швидка нотатка для команди…"
        className="mt-3 w-full rounded-[12px] border border-[var(--enver-border)] px-3 py-2 text-[14px] outline-none transition focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20"
      />
      <button
        type="button"
        disabled={!canUpdateLead || busy || !draft.trim()}
        onClick={() => void post()}
        className={cn(
          "mt-2 rounded-[12px] bg-[#2563EB] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#1D4ED8] disabled:opacity-50",
        )}
      >
        Додати нотатку
      </button>
    </section>
  );
}
