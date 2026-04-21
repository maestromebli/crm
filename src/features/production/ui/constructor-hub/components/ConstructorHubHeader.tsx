"use client";

import { CalendarClock, Factory, Flag, Hash, MapPin, UserRound } from "lucide-react";
import type { ConstructorProjectHeader } from "../constructor-hub.types";
import { ConstructorStatusBadge } from "./ConstructorStatusBadge";

const PRIORITY_LABEL: Record<ConstructorProjectHeader["priority"], string> = {
  LOW: "Низький",
  NORMAL: "Звичайний",
  HIGH: "Високий",
  URGENT: "Терміновий",
};

export function ConstructorHubHeader({ header }: { header: ConstructorProjectHeader }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/60 to-indigo-50/30 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Робоча зона конструктора</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{header.projectName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {header.clientName} · {header.dealNumber}
          </p>
        </div>
        <ConstructorStatusBadge status={header.status} />
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        <HeaderMeta icon={Hash} label="Замовлення / замовлення" value={header.dealNumber} />
        <HeaderMeta icon={MapPin} label="Адреса обʼєкта" value={header.objectAddress} />
        <HeaderMeta icon={UserRound} label="Менеджер" value={header.managerName} />
        <HeaderMeta icon={Factory} label="Кер. виробництва" value={header.headOfProductionName} />
        <HeaderMeta icon={UserRound} label="Конструктор" value={header.assignedConstructorName} />
        <HeaderMeta
          icon={CalendarClock}
          label="Дедлайн"
          value={header.deadlineAt ? new Date(header.deadlineAt).toLocaleString("uk-UA") : "Не вказано"}
        />
        <HeaderMeta icon={Flag} label="Приоритет" value={PRIORITY_LABEL[header.priority]} />
      </div>
    </section>
  );
}

function HeaderMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
