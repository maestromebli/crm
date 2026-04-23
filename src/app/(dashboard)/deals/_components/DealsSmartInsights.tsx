"use client";

import { Lightbulb, TrendingUp } from "lucide-react";
import { useMemo } from "react";

import type { DealHubRow } from "./deal-hub-row";

type Props = {
  rows: DealHubRow[];
};

/** Динамічні підказки з поточної вибірки — без зовнішніх API, як «розумний» шар CRM. */
export function DealsSmartInsights({ rows }: Props) {
  const insights = useMemo(() => {
    const out: string[] = [];
    const open = rows.filter((r) => r.status === "OPEN");
    // eslint-disable-next-line react-hooks/purity -- snapshot часу для overdue vs nextActionAt
    const now = Date.now();

    const noNext = open.filter((r) => {
      const has =
        Boolean(r.nextStepLabel?.trim()) && Boolean(r.nextActionAt);
      return !has;
    }).length;
    if (noNext > 0 && open.length > 0) {
      out.push(
        `${noNext} з ${open.length} відкритих без наступного кроку й дати — задайте в робочому місці, щоб не втрачати контроль.`,
      );
    }

    const overdue = open.filter((r) => {
      if (!r.nextActionAt) return false;
      const t = new Date(r.nextActionAt).getTime();
      return !Number.isNaN(t) && t < now;
    }).length;
    if (overdue > 0) {
      out.push(
        `${overdue} замовлень з простроченим запланованим контактом — пріоритезуйте наступний контакт.`,
      );
    }

    const noEst = open.filter((r) => r.estimatesCount === 0).length;
    if (noEst > 0 && open.length > 3) {
      out.push(
        `${noEst} відкритих без смети — додайте прорахунок, щоб узгодити КП.`,
      );
    }

    const noContract = open.filter((r) => !r.hasContract).length;
    if (noContract > 0 && rows.some((r) => r.hasContract)) {
      out.push(
        `${noContract} замовлень ще без договору в системі — перевірте юридичний блок у робочому місці.`,
      );
    }

    const critical = rows.filter((r) => r.warningBadge === "critical").length;
    if (critical > 0) {
      out.push(
        `${critical} замовлень з критичним ризиком у списку — відкрийте картку та закрийте блокери.`,
      );
    }

    const byPipe = new Map<string, number>();
    for (const r of rows) {
      byPipe.set(r.pipelineName, (byPipe.get(r.pipelineName) ?? 0) + 1);
    }
    if (byPipe.size > 1) {
      const top = [...byPipe.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) {
        out.push(
          `Найбільший потік зараз: «${top[0]}» (${top[1]} замовлень) — зосередьте увагу на стадіях цієї воронки.`,
        );
      }
    }

    return out.slice(0, 4);
  }, [rows]);

  if (insights.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--enver-accent)]/25 bg-gradient-to-br from-[var(--enver-accent-soft)]/50 via-[var(--enver-card)] to-[var(--enver-surface)] px-3 py-3 shadow-sm shadow-[var(--enver-shadow)]">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--enver-accent)] text-white shadow-md shadow-[var(--enver-accent)]/25">
          <Lightbulb className="h-4 w-4" strokeWidth={2} aria-hidden />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--enver-accent-hover)]">
            Інтелектуальний огляд
          </p>
          <p className="text-[11px] text-[var(--enver-text-muted)]">
            Підказки з поточної вибірки та фільтрів
          </p>
        </div>
        <TrendingUp
          className="ml-auto h-4 w-4 text-[var(--enver-accent)] opacity-80"
          aria-hidden
        />
      </div>
      <ul className="space-y-1.5 text-[11px] leading-snug text-[var(--enver-text)]">
        {insights.map((t) => (
          <li
            key={t}
            className="flex gap-2 rounded-lg border border-[var(--enver-border)]/60 bg-[var(--enver-card)]/80 px-2.5 py-1.5"
          >
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--enver-accent)]" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
