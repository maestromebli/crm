"use client";

import { useMemo, useState } from "react";
import { postJson } from "@/lib/api/patch-json";
import type { FinanceTransactionType } from "../types/models";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { financeTransactionTypeUa } from "../lib/labels";

type ProjectOpt = { id: string; label: string };
type CatOpt = { id: string; label: string; group: string };
type AccOpt = { id: string; label: string };

const TYPES: FinanceTransactionType[] = [
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "REFUND",
  "PAYROLL",
  "COMMISSION",
];

const PAYMENT_OPTIONS = [
  { value: "Безготівковий переказ", label: "Безготівковий переказ" },
  { value: "Готівка", label: "Готівка" },
  { value: "Картка", label: "Картка" },
  { value: "Інше", label: "Інше" },
];

type Props = {
  projects: ProjectOpt[];
  incomeCategories: CatOpt[];
  expenseCategories: CatOpt[];
  accounts: AccOpt[];
  canSubmit: boolean;
};

type TransactionCreateResponse = {
  ok?: boolean;
  id?: string;
  error?: string;
};

export function OperationalAccountingForm({
  projects,
  incomeCategories,
  expenseCategories,
  accounts,
  canSubmit,
}: Props) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [type, setType] = useState<FinanceTransactionType>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UAH");
  const [transactionDate, setTransactionDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_OPTIONS[0]!.value);
  const [counterpartyNote, setCounterpartyNote] = useState("");
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState<"DRAFT" | "CONFIRMED">("CONFIRMED");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okId, setOkId] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    if (type === "INCOME") return incomeCategories;
    if (
      type === "EXPENSE" ||
      type === "PAYROLL" ||
      type === "COMMISSION"
    ) {
      return expenseCategories;
    }
    return [] as CatOpt[];
  }, [type, incomeCategories, expenseCategories]);

  const amountNum = Number(amount.replace(",", "."));
  const valid =
    projectId &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    transactionDate.length >= 10;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !valid) return;
    setBusy(true);
    setErr(null);
    setOkId(null);
    try {
      const data = (await postJson(
        "/api/finance/transactions",
        {
          projectId,
          type,
          amount: amountNum,
          currency,
          transactionDate,
          accountId: accountId || null,
          categoryId: categoryId || null,
          documentNumber: documentNumber || null,
          paymentMethod: paymentMethod || null,
          counterpartyNote: counterpartyNote || null,
          comment: comment || null,
          status: posting,
        },
      )) as TransactionCreateResponse;
      setOkId(typeof data.id === "string" ? data.id : "ok");
      setAmount("");
      setDocumentNumber("");
      setCounterpartyNote("");
      setComment("");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="mx-auto max-w-2xl space-y-5 rounded-xl border border-slate-200 bg-[var(--enver-card)] p-5 shadow-sm"
    >
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-semibold text-[var(--enver-text)]">
          Первинні реквізити проводки
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Одна операція = один рядок у реєстрі руху коштів по проєкту. Підходить для
          щоденного відображення надходжень, оплат постачальникам, внутрішніх
          переказів та повернень.
        </p>
      </div>

      {!canSubmit ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          У вашій ролі недоступне створення проводок. Зверніться до адміністратора
          (потрібні права на оплату / угоди).
        </p>
      ) : null}

      <label className="block text-xs font-medium text-slate-700">
        Проєкт <span className="text-rose-600">*</span>
        <select
          className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={!projects.length}
          required
        >
          {projects.length === 0 ? (
            <option value="">— Немає проєктів у базі —</option>
          ) : (
            projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))
          )}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-700">
          Тип операції <span className="text-rose-600">*</span>
          <select
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            value={type}
            onChange={(e) =>
              setType(e.target.value as FinanceTransactionType)
            }
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {financeTransactionTypeUa(t)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-700">
          Статус у обліку
          <select
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            value={posting}
            onChange={(e) =>
              setPosting(e.target.value as "DRAFT" | "CONFIRMED")
            }
          >
            <option value="CONFIRMED">Проведено</option>
            <option value="DRAFT">Чернетка</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-700">
          Сума <span className="text-rose-600">*</span>
          <Input
            className="mt-1 h-10 text-sm"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          Валюта
          <select
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="UAH">UAH</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
      </div>

      <label className="block text-xs font-medium text-slate-700">
        Дата операції <span className="text-rose-600">*</span>
        <Input
          className="mt-1 h-10 text-sm"
          type="date"
          value={transactionDate}
          onChange={(e) => setTransactionDate(e.target.value)}
          required
        />
      </label>

      <label className="block text-xs font-medium text-slate-700">
        Каса / банк (рахунок обліку)
        <select
          className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          disabled={!accounts.length}
        >
          <option value="">— Не вказано —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      {categoryOptions.length > 0 ? (
        <label className="block text-xs font-medium text-slate-700">
          Стаття (категорія)
          <select
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— Не вказано —</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Для типів «Переказ» / «Повернення» стаття не обовʼязкова. За потреби додайте
          деталі в коментар.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-700">
          Номер первинного документа
          <Input
            className="mt-1 h-10 text-sm"
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value.slice(0, 120))}
            placeholder="Рахунок, видаткова, ПН…"
          />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          Форма оплати
          <select
            className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            {PAYMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-xs font-medium text-slate-700">
        Контрагент / коротко про призначення платежу
        <Input
          className="mt-1 h-10 text-sm"
          value={counterpartyNote}
          onChange={(e) => setCounterpartyNote(e.target.value.slice(0, 500))}
          placeholder="ТОВ «…», ПІБ, договір №…"
        />
      </label>

      <label className="block text-xs font-medium text-slate-700">
        Коментар бухгалтера
        <Textarea
          className="mt-1 min-h-[88px] text-sm"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 2000))}
          placeholder="Додаткові умови, розбивка, посилання на файл…"
        />
      </label>

      {err ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {err}
        </p>
      ) : null}
      {okId ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Проводку збережено. Ідентифікатор: <span className="font-mono">{okId}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <Button
          type="submit"
          disabled={!canSubmit || !valid || !projects.length || busy}
        >
          {busy ? "Збереження…" : "Зберегти проводку"}
        </Button>
        <p className="text-[11px] text-slate-500">
          Джерело: MANUAL · імпорт з банку не змінює цей запис
        </p>
      </div>
    </form>
  );
}
