"use client";

import Link from "next/link";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";

type Props = {
  data: DealWorkspacePayload;
};

export function DealLeadTransferCard({ data }: Props) {
  if (!data.leadId) return null;

  const summary = data.leadConversionSummary;
  const recentMessages = data.leadMessagesPreview.slice(-3);

  return (
    <section className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
          Перенесено з ліда
        </h3>
        <Link
          href={`/leads/${data.leadId}`}
          className="text-[11px] font-medium text-[var(--enver-accent-hover)] underline"
        >
          Відкрити лід
        </Link>
      </div>

      <ul className="mt-2 space-y-1 text-xs text-[var(--enver-text-muted)]">
        <li>
          Файли в угоді:{" "}
          <span className="font-medium text-[var(--enver-text)]">{data.attachmentsCount}</span>
          {summary ? ` (мігровано: ${summary.filesMigrated})` : ""}
        </li>
        <li>
          Повідомлень у контексті:{" "}
          <span className="font-medium text-[var(--enver-text)]">{data.leadMessagesPreview.length}</span>
          {summary ? ` (${summary.communicationMode === "full" ? "повна історія" : "останні"})` : ""}
        </li>
        {summary ? (
          <li>
            Контакти/смети:{" "}
            <span className="font-medium text-[var(--enver-text)]">
              {summary.contactsLinked} / {summary.estimatesMoved}
            </span>
          </li>
        ) : null}
      </ul>

      {recentMessages.length > 0 ? (
        <div className="mt-3 rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
            Останні повідомлення з ліда
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {recentMessages.map((message) => (
              <li key={message.id} className="text-[11px] text-[var(--enver-text-muted)]">
                {message.body}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
