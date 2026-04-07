"use client";

import { useCallback, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { DirectorAiBlock } from "../executive-types";
import { postJson } from "@/lib/api/patch-json";
import { cn } from "../../../lib/utils";

type DirectorAiPanelProps = {
  initial: DirectorAiBlock;
  /** Серіалізований контекст для AI (українською, без PII). */
  aiContextText: string;
};

export function DirectorAiPanel({ initial, aiContextText }: DirectorAiPanelProps) {
  const [block, setBlock] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<{ text?: string; error?: string }>("/api/ai/summary", {
        type: "executive_dashboard",
        context: aiContextText,
      });
      if (data.text) {
        setBlock((b) => ({
          ...b,
          summaryLines: data.text!.split(/\n+/).filter(Boolean).slice(0, 6),
        }));
      }
    } catch {
      setError("Не вдалося звернутися до AI.");
    } finally {
      setLoading(false);
    }
  }, [aiContextText]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--enver-border)] bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-5 text-slate-100 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <Sparkles className="h-4 w-4 text-amber-300" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              AI-аналітика директора
            </h2>
            <p className="text-[11px] text-slate-400">
              Структурований огляд + оновлення тексту через AI
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition",
            "hover:bg-white/10 disabled:opacity-50",
          )}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Оновити
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <section>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Підсумок дня
          </p>
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-200">
            {block.summaryLines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </section>

        {block.problems.length > 0 ? (
          <section>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Проблеми
            </p>
            <ul className="mt-2 space-y-2">
              {block.problems.map((p, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-rose-200">{p.label}</span>
                  <span className="text-slate-300"> — {p.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {block.recommendations.length > 0 ? (
          <section>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Рекомендації
            </p>
            <ul className="mt-2 space-y-2">
              {block.recommendations.map((r, i) => (
                <li
                  key={i}
                  className="flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-white">{r.action}</span>
                  <span className="text-xs text-slate-400">
                    {r.ownerHint} · пріоритет: {r.priority}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase text-slate-500">Прогноз виручки</p>
            <p className="text-xs text-slate-200">{block.forecast.revenue}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">Ризики</p>
            <p className="text-xs text-slate-200">{block.forecast.risks}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">Вузькі місця</p>
            <p className="text-xs text-slate-200">{block.forecast.bottlenecks}</p>
          </div>
        </section>

        {error ? (
          <p className="text-xs text-rose-300">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
