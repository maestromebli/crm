"use client";

import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { motion, useReducedMotion } from "framer-motion";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "../../../../lib/utils";

function formatUah(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return (
    new Intl.NumberFormat("uk-UA", {
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n) + " грн"
  );
}

export type LeadHubClientHeaderProps = {
  lead: LeadDetailRow;
  quickStageId: string;
  stageBusy: boolean;
  canUpdateLead: boolean;
  onStageChange: (stageId: string) => void;
};

export function LeadHubClientHeader({
  lead,
  quickStageId,
  stageBusy,
  canUpdateLead,
  onStageChange,
}: LeadHubClientHeaderProps) {
  const reduceMotion = useReducedMotion();
  const displayName =
    lead.contact?.fullName?.trim() || lead.contactName?.trim() || lead.title;
  const phone =
    lead.contact?.phone?.trim() || lead.phone?.trim() || null;
  const estTotal =
    lead.activeEstimateId != null
      ? lead.estimates.find((e) => e.id === lead.activeEstimateId)?.totalPrice ??
        null
      : lead.estimates[0]?.totalPrice ?? null;
  const budget =
    lead.qualification.budgetRange?.trim() ||
    (estTotal != null ? formatUah(estTotal) : "—");
  const deadline =
    lead.qualification.timeline?.trim() ||
    (lead.nextContactAt
      ? format(new Date(lead.nextContactAt), "d MMM yyyy", { locale: uk })
      : "—");

  return (
    <motion.header
      className="enver-card-appear rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]"
      initial={reduceMotion ? false : { opacity: 0.92, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-[var(--enver-text)]">
            {displayName}
          </h1>
          <p className="mt-1 text-[12px] text-[var(--enver-muted)]">
            Відповідальний:{" "}
            <span className="text-[var(--enver-text)]">
              {lead.owner.name ?? lead.owner.email}
            </span>
          </p>
        </div>
        {canUpdateLead ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <select
                value={quickStageId}
                disabled={stageBusy}
                onChange={(e) => onStageChange(e.target.value)}
                className="max-w-[14rem] cursor-pointer rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--enver-text)] outline-none transition duration-200 focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {lead.pipelineStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isFinal ? " · фінал" : ""}
                  </option>
                ))}
              </select>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[18rem]">
              Швидка зміна стадії воронки; зміни зберігаються одразу на сервері.
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="rounded-[12px] border border-[var(--enver-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--enver-text)]">
            {lead.stage.name}
          </span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              className="cursor-default rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-bg)] px-3 py-2"
              whileHover={reduceMotion ? undefined : { y: -1, transition: { duration: 0.18 } }}
            >
              <dt className="text-[12px] text-[var(--enver-muted)]">Телефон</dt>
              <dd className="mt-0.5 text-[14px] font-medium text-[var(--enver-text)]">
                {phone ?? "—"}
              </dd>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[16rem]">
            Основний номер з картки ліда або пов&apos;язаного контакту.
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              className="cursor-default rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-bg)] px-3 py-2"
              whileHover={reduceMotion ? undefined : { y: -1, transition: { duration: 0.18 } }}
            >
              <dt className="text-[12px] text-[var(--enver-muted)]">Джерело</dt>
              <dd className="mt-0.5 text-[14px] font-medium text-[var(--enver-text)]">
                {lead.source || "—"}
              </dd>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[16rem]">
            Канал залучення: реклама, рекомендація, сайт тощо.
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              className="cursor-default rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-bg)] px-3 py-2"
              whileHover={reduceMotion ? undefined : { y: -1, transition: { duration: 0.18 } }}
            >
              <dt className="text-[12px] text-[var(--enver-muted)]">Бюджет</dt>
              <dd className="mt-0.5 text-[14px] font-medium text-[var(--enver-text)]">
                {budget}
              </dd>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[16rem]">
            Кваліфікаційний діапазон або сума активної смети, якщо є.
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              className="cursor-default rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-bg)] px-3 py-2"
              whileHover={reduceMotion ? undefined : { y: -1, transition: { duration: 0.18 } }}
            >
              <dt className="text-[12px] text-[var(--enver-muted)]">Дедлайн / горизонт</dt>
              <dd className="mt-0.5 text-[14px] font-medium text-[var(--enver-text)]">
                {deadline}
              </dd>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[16rem]">
            Очікуваний горизонт угоди або дата наступного контакту.
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              className={cn(
                "cursor-default rounded-[12px] border px-3 py-2",
                lead.stage.isFinal
                  ? "border-[var(--enver-border)] bg-[var(--enver-bg)]"
                  : "border-[#2563EB]/25 bg-[var(--enver-accent-soft)]",
              )}
              whileHover={reduceMotion ? undefined : { y: -1, transition: { duration: 0.18 } }}
            >
              <dt className="text-[12px] text-[var(--enver-muted)]">Стадія</dt>
              <dd className="mt-0.5 text-[14px] font-semibold text-[var(--enver-text)]">
                {lead.stage.name}
              </dd>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[16rem]">
            Поточна стадія воронки; узгоджується зі списком стадій зліва.
          </TooltipContent>
        </Tooltip>
      </dl>
    </motion.header>
  );
}
