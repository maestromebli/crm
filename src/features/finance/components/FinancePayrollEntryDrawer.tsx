"use client";

import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

type ProjectOpt = { id: string; label: string };
type ObjectOpt = { id: string; projectId: string; label: string };

type Props = {
  projects: ProjectOpt[];
  objects: ObjectOpt[];
};

export function FinancePayrollEntryDrawer({ projects, objects }: Props) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [objectId, setObjectId] = useState("");
  const [roleType, setRoleType] = useState("Збірка");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [comment, setComment] = useState("");

  const objectsForProject = objects.filter((o) => o.projectId === projectId);

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="border-emerald-200 bg-emerald-50/80 text-emerald-950 hover:bg-emerald-100" onClick={() => setOpen(true)}>
        Нарахування ЗП
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
          <div className="h-full w-full max-w-lg overflow-y-auto border-l border-slate-200 bg-[var(--enver-card)] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Операційний облік</p>
                <h3 className="text-lg font-semibold text-slate-900">Введення нарахування зарплати</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Прив&apos;язка до замовлення та об&apos;єкта — для P&amp;L по адресі. Демо: дані не зберігаються на сервері.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Закрити </Button>
            </div>
            <div className="grid gap-3">
              <label className="text-xs font-medium text-slate-700">
                Проєкт (замовлення)
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setObjectId("");
                  }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-700">
                Об&apos;єкт (адреса)
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
                  value={objectId}
                  onChange={(e) => setObjectId(e.target.value)}
                >
                  <option value="">— оберіть об&apos;єкт —</option>
                  {objectsForProject.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-700">
                Роль / етап
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
                  value={roleType}
                  onChange={(e) => setRoleType(e.target.value)}
                >
                  {["Замір", "Конструктор", "Збірка", "Установка", "Логістика", "Інше"].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-700">
                Сума, грн
                <Input
                  className="mt-1"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                Дата виплати / нарахування
                <Input className="mt-1" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </label>
              <label className="text-xs font-medium text-slate-700">
                Коментар для бухгалтерії
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Номер табелю, зміна, ПІБ…"
                />
              </label>
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-950">
                Після інтеграції з бекендом проводка потрапить у реєстр з типом PAYROLL і категорією «Зарплата».
              </div>
              <Button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setAmount("");
                  setComment("");
                }}
              >
                Зафіксувати (демо)
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
