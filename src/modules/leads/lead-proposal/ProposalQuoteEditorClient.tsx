"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Редактор КП зібраний у вкладці «КП» / «Розрахунок»; старі посилання ведуть сюди. */
export function ProposalQuoteEditorClient(props: {
  leadId: string;
  proposalId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => {
      router.replace(`/leads/${props.leadId}/kp`);
      setPending(false);
    }, 400);
    return () => clearTimeout(t);
  }, [props.leadId, router]);

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-6 text-sm shadow-sm">
      <p className="font-semibold text-[var(--enver-text)]">
        Редактор КП перенесено
      </p>
      <p className="mt-2 leading-relaxed text-slate-600">
        Комерційна пропозиція редагується у розділі{" "}
        <span className="font-medium text-slate-800">«Розрахунок» → «КП»</span>{" "}
        на картці ліда. Це старе посилання залишено для сумісності.
      </p>
      {props.proposalId ? (
        <p className="mt-2 text-xs text-slate-500">
          Запис КП: <code className="rounded bg-slate-100 px-1">{props.proposalId}</code>
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/leads/${props.leadId}/kp`}
          className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
        >
          Відкрити КП зараз
        </Link>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-[var(--enver-hover)]"
          onClick={() => router.back()}
        >
          Назад
        </button>
      </div>
      {pending ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Автоматичне перенаправлення через кілька секунд…
        </p>
      ) : null}
    </div>
  );
}
