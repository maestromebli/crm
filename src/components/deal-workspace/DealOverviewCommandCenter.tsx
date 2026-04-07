"use client";

import { format } from "date-fns";
import { uk } from "date-fns/locale";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import { useDealWorkspace } from "../../hooks/deal-workspace/useDealWorkspace";
import { cn } from "../../lib/utils";

type Props = {
  data: DealWorkspacePayload;
  onTab: (id: DealWorkspaceTabId) => void;
};

const card =
  "rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-700";

export function DealOverviewCommandCenter({ data, onTab }: Props) {
  const w = useDealWorkspace(data);
  const comm = data.meta.communicationsNote?.trim();
  const est = data.operationalStats.latestEstimate;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className={cn(card, "lg:col-span-2")}>
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Клієнт
          </p>
          <p className="mt-1 font-medium text-[var(--enver-text)]">{data.client.name}</p>
          <p className="mt-0.5 text-slate-600">
            {data.primaryContact
              ? [
                  data.primaryContact.fullName,
                  data.primaryContact.phone,
                  data.primaryContact.email,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Основний контакт не прив’язаний"}
          </p>
        </div>
        <div className={card}>
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Факти
          </p>
          <ul className="mt-1 space-y-0.5">
            <li>
              <span className="text-slate-500">Стадія:</span>{" "}
              <span className="font-medium text-[var(--enver-text)]">
                {data.stage.name}
              </span>
            </li>
            <li>
              <span className="text-slate-500">Відповідальний:</span>{" "}
              {data.owner.name ?? data.owner.email}
            </li>
            <li>
              <span className="text-slate-500">Сума угоди:</span>{" "}
              {data.deal.value != null
                ? `${data.deal.value.toLocaleString("uk-UA")} ${data.deal.currency ?? ""}`
                : "—"}
            </li>
          </ul>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onTab("overview")}
          className="rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2 text-left transition hover:bg-sky-50"
        >
          <p className="text-[10px] font-semibold uppercase text-sky-800">
            Наступний крок
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--enver-text)]">
            {w.nextActionLabel}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">
            {data.meta.nextActionAt
              ? format(new Date(data.meta.nextActionAt), "d MMM yyyy, HH:mm", {
                  locale: uk,
                })
              : "Дату не задано — відкрийте «Редагувати дані» в шапці"}
          </p>
        </button>
        <div className={card}>
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Остання комунікація (нотатка)
          </p>
          <p className="mt-1 line-clamp-3 text-slate-700">
            {comm || "Нотаток у блоці «Повідомлення» ще немає."}
          </p>
          <button
            type="button"
            className="mt-2 text-[11px] font-medium text-[var(--enver-text)] underline"
            onClick={() => onTab("messages")}
          >
            Відкрити повідомлення
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className={card}>
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Задачі
          </p>
          <p className="mt-1 font-medium text-[var(--enver-text)]">
            Відкриті: {w.stats.openTasksCount}
            {w.stats.overdueOpenTasksCount > 0 ? (
              <span className="text-rose-700">
                {" "}
                · прострочено {w.stats.overdueOpenTasksCount}
              </span>
            ) : null}
          </p>
          <p className="text-slate-600">Закрито: {w.stats.completedTasksCount}</p>
          <button
            type="button"
            className="mt-2 text-[11px] font-medium text-[var(--enver-text)] underline"
            onClick={() => onTab("tasks")}
          >
            До задач
          </button>
        </div>
        <div className={card}>
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Смета
          </p>
          {est ? (
            <>
              <p className="mt-1 font-medium text-[var(--enver-text)]">
                v{est.version} · {est.status}
              </p>
              <p className="text-slate-600">
                Сума:{" "}
                {est.totalPrice != null
                  ? est.totalPrice.toLocaleString("uk-UA")
                  : "—"}
              </p>
            </>
          ) : (
            <p className="mt-1 text-slate-600">Смет ще немає.</p>
          )}
          <button
            type="button"
            className="mt-2 text-[11px] font-medium text-[var(--enver-text)] underline"
            onClick={() => onTab("estimate")}
          >
            Смети
          </button>
        </div>
        <div className={card}>
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Оплата
          </p>
          <p className="mt-1 font-medium text-[var(--enver-text)]">
            {w.paymentStrip.label}
          </p>
          <button
            type="button"
            className="mt-2 text-[11px] font-medium text-[var(--enver-text)] underline"
            onClick={() => onTab("payment")}
          >
            Віхи оплати
          </button>
        </div>
      </div>

      {w.warnings.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Ризики та увага
          </p>
          <ul className="mt-2 space-y-1">
            {w.warnings.map((x) => (
              <li
                key={x.key}
                className={cn(
                  "text-xs",
                  x.level === "critical" && "font-medium text-rose-800",
                  x.level === "warning" && "text-amber-900",
                  x.level === "info" && "text-slate-600",
                )}
              >
                · {x.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[11px] text-slate-500">
        Журнал подій та деталі документів — у відповідних вкладках праворуч у
        навігації.
      </p>
    </div>
  );
}
