"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { AiWorkspacePayload } from "../../ai/workspace/types";
import { cn } from "../../../lib/utils";

type Props = {
  workspace: AiWorkspacePayload | null;
  loading: boolean;
  error: string | null;
};

function Block({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white px-3 py-2.5",
        className,
      )}
    >
      <p className="text-[11px] font-medium text-slate-600">
        {title}
      </p>
      <div className="mt-1.5 text-xs leading-relaxed text-slate-700">{children}</div>
    </div>
  );
}

export function AiWorkspaceBlocks({ workspace, loading, error }: Props) {
  if (loading && !workspace) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Завантаження контексту AI…
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] text-rose-800">
        {error}
      </p>
    );
  }

  if (!workspace) {
    return (
      <p className="text-[11px] text-slate-500">
        Відкрийте картку ліда або замовлення — тут з’явиться контекстний аналіз.
      </p>
    );
  }

  const b = workspace.blocks;
  const prod = workspace.modules.production;

  return (
    <div className="space-y-2.5">
      <Block title="Що відбувається">
        <p>{b.whatsHappening}</p>
      </Block>
      <Block title="Наступний крок">
        <p className="font-medium text-slate-800">{b.nextStep}</p>
      </Block>
      {b.missing.length > 0 ? (
        <Block title="Що відсутнє">
          <ul className="list-inside list-disc space-y-0.5">
            {b.missing.slice(0, 8).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Block>
      ) : null}
      {b.risks.length > 0 ? (
        <Block title="Ризики" className="border-amber-200 bg-amber-50/40">
          <ul className="list-inside list-disc space-y-0.5 text-amber-950">
            {b.risks.slice(0, 6).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Block>
      ) : null}
      {prod && prod.score0to100 != null ? (
        <Block title="Готовність до виробництва">
          <p>
            Оцінка:{" "}
            <span className="font-semibold tabular-nums">{prod.score0to100}</span>{" "}
            / 100 ·{" "}
            {prod.recommendation === "ready"
              ? "можна рухатися далі"
              : prod.recommendation === "not_ready"
                ? "є блокери"
                : prod.recommendation === "partial"
                  ? "часткова готовність"
                  : "немає знімка"}
          </p>
          {prod.blockers.length > 0 ? (
            <p className="mt-1 text-[11px] text-rose-800">
              Критичне: {prod.blockers.slice(0, 4).join("; ")}
            </p>
          ) : null}
          {prod.warnings.length > 0 ? (
            <p className="mt-1 text-[11px] text-amber-900">
              Попередження: {prod.warnings.slice(0, 4).join("; ")}
            </p>
          ) : null}
        </Block>
      ) : null}
      <Block title="AI-підсумок">
        <p>{b.aiSummary}</p>
        {b.confirmedFacts.length > 0 ? (
          <div className="mt-2 border-t border-slate-200/80 pt-2">
            <p className="text-[10px] font-medium text-slate-500">Підтверджені дані</p>
            <ul className="mt-1 list-inside list-disc text-[11px] text-slate-600">
              {b.confirmedFacts.slice(0, 6).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {b.inferredNotes.length > 0 ? (
          <div className="mt-2 border-t border-slate-200/80 pt-2">
            <p className="text-[10px] font-medium text-slate-500">
              Висновки / перевірити
            </p>
            <ul className="mt-1 list-inside list-disc text-[11px] text-slate-600">
              {b.inferredNotes.slice(0, 5).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Block>
      {loading ? (
        <p className="flex items-center gap-1 text-[10px] text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Оновлення…
        </p>
      ) : null}
    </div>
  );
}
