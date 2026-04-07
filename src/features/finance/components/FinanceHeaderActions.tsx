"use client";

import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "../../../components/ui/sheet";

type SelectOption = { id: string; label: string };
type RecognizedExpenseResponse = {
  ok: true;
  recognized: {
    projectHint: string | null;
    categoryHint: string | null;
    counterparty: string | null;
    documentNumber: string | null;
    qty: number | null;
    unitCost: number | null;
    total: number | null;
    expenseDate: string | null;
    comment: string | null;
    confidence: number;
    lineItems: Array<{
      name: string;
      qty: number;
      unit: string;
      unitCost: number;
      total: number;
      categoryHint: string | null;
    }>;
  };
};

type Props = {
  projects: SelectOption[];
  expenseCategories: SelectOption[];
  accounts: SelectOption[];
  canEdit: boolean;
};

function FormLabel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-700">
      {title}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function FinanceHeaderActions({ projects, expenseCategories, accounts, canEdit }: Props) {
  return (
    <>
      <ClientPaymentDrawer projects={projects} accounts={accounts} canEdit={canEdit} />
      <ExpenseDrawer projects={projects} expenseCategories={expenseCategories} accounts={accounts} canEdit={canEdit} />
      <ExportModal projects={projects} />
    </>
  );
}

function ClientPaymentDrawer({
  projects,
  accounts,
  canEdit,
}: {
  projects: SelectOption[];
  accounts: SelectOption[];
  canEdit: boolean;
}) {
  const [amount, setAmount] = useState<string>("");
  const isValid = Number(amount) > 0;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm">Додати платіж клієнта</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-xl overflow-y-auto">
        <SheetTitle className="text-sm font-semibold text-slate-900">Новий платіж клієнта</SheetTitle>
        <SheetDescription className="mt-1 text-xs text-slate-500">
          Форма реєстрації фактичного надходження коштів.
        </SheetDescription>
        <div className="mt-4 grid gap-3">
          <FormLabel title="Проєкт">
            <select className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </FormLabel>
          <div className="grid grid-cols-2 gap-3">
            <FormLabel title="Сума">
              <Input
                className="h-9 text-xs"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </FormLabel>
            <FormLabel title="Валюта">
              <select className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs">
                <option value="UAH">UAH</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </FormLabel>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormLabel title="Дата платежу">
              <Input className="h-9 text-xs" type="date" />
            </FormLabel>
            <FormLabel title="Рахунок надходження">
              <select className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs">
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </FormLabel>
          </div>
          <FormLabel title="Тип платежу">
            <select className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs">
              <option>Аванс клієнта</option>
              <option>Доплата клієнта</option>
              <option>Фінальний платіж</option>
            </select>
          </FormLabel>
          <div className="grid grid-cols-2 gap-3">
            <FormLabel title="Номер документа">
              <Input className="h-9 text-xs" placeholder="INV-2026-001" />
            </FormLabel>
            <FormLabel title="Метод оплати">
              <select className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs">
                <option>Безготівка</option>
                <option>Готівка</option>
                <option>Картка</option>
              </select>
            </FormLabel>
          </div>
          <FormLabel title="Коментар">
            <Textarea className="min-h-[90px] text-xs" placeholder="Деталі платежу" />
          </FormLabel>
          <FormLabel title="Файл підтвердження">
            <Input className="h-9 text-xs" type="file" />
          </FormLabel>
          {!isValid ? <p className="text-xs text-rose-600">Вкажіть суму платежу більше 0.</p> : null}
          {!canEdit ? (
            <p className="text-xs text-amber-700">
              У вашій ролі доступно створення запиту. Проведення виконує бухгалтер.
            </p>
          ) : null}
          <Button disabled={!isValid}>{canEdit ? "Зберегти платіж" : "Надіслати запит"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ExpenseDrawer({
  projects,
  expenseCategories,
  accounts,
  canEdit,
}: {
  projects: SelectOption[];
  expenseCategories: SelectOption[];
  accounts: SelectOption[];
  canEdit: boolean;
}) {
  const [expenseScope, setExpenseScope] = useState<"OBJECT_DIRECT" | "GENERAL_CATEGORY">(
    "OBJECT_DIRECT",
  );
  const [generalCategory, setGeneralCategory] = useState<string>("Офісні витрати");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id ?? "");
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    expenseCategories[0]?.id ?? "",
  );
  const [counterparty, setCounterparty] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [documentNumber, setDocumentNumber] = useState<string>("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [aiNote, setAiNote] = useState<string>("");
  const [aiApplied, setAiApplied] = useState<boolean>(false);
  const [aiLineItems, setAiLineItems] = useState<RecognizedExpenseResponse["recognized"]["lineItems"]>([]);
  const [auditLog, setAuditLog] = useState<Array<{ at: string; action: string }>>([]);
  const [qty, setQty] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(0);
  const total = useMemo(() => qty * unitCost, [qty, unitCost]);
  const canRunAi = Boolean(sourceFile) && !isAiAnalyzing;

  const runAiRecognition = async (): Promise<void> => {
    if (!sourceFile) return;
    setIsAiAnalyzing(true);
    setAiNote("");
    setAiApplied(false);
    try {
      const form = new FormData();
      form.append("file", sourceFile);
      const res = await fetch("/api/finance/expense-recognize", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const fail = (await res.json()) as { error?: string };
        setAiNote(fail.error ?? "Не вдалося розпізнати файл.");
        setAiLineItems([]);
        return;
      }
      const data = (await res.json()) as RecognizedExpenseResponse;
      const recognized = data.recognized;
      setAiLineItems(recognized.lineItems ?? []);

      if (recognized.categoryHint) {
        const category = expenseCategories.find((c) =>
          c.label.toLowerCase().includes(recognized.categoryHint!.toLowerCase()),
        );
        if (category) setSelectedCategoryId(category.id);
      }
      if (recognized.counterparty) setCounterparty(recognized.counterparty);
      if (recognized.documentNumber) setDocumentNumber(recognized.documentNumber);
      if (typeof recognized.qty === "number" && Number.isFinite(recognized.qty)) setQty(recognized.qty);
      if (typeof recognized.unitCost === "number" && Number.isFinite(recognized.unitCost))
        setUnitCost(recognized.unitCost);
      if (recognized.expenseDate) setExpenseDate(recognized.expenseDate);
      if (recognized.comment) setComment(recognized.comment);
      if (recognized.projectHint) {
        const project = projects.find((p) =>
          p.label.toLowerCase().includes(recognized.projectHint!.toLowerCase()),
        );
        if (project) setSelectedProjectId(project.id);
      }
      setSelectedAccountId(accounts[1]?.id ?? accounts[0]?.id ?? selectedAccountId);

      setAiApplied(true);
      setAuditLog((prev) => [
        {
          at: new Date().toISOString(),
          action: `ШІ розпізнав документ ${sourceFile.name} і заповнив поля`,
        },
        ...prev,
      ]);
      setAiNote(
        `Розпізнано із впевненістю ${(recognized.confidence * 100).toFixed(0)}%. Поля форми оновлено.`,
      );
    } catch {
      setAiNote("Помилка з'єднання з сервісом розпізнавання.");
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm">Додати витрату</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-xl overflow-y-auto">
        <SheetTitle className="text-sm font-semibold text-slate-900">Нова витрата</SheetTitle>
        <SheetDescription className="mt-1 text-xs text-slate-500">
          Фіксація витрати як окремого облікового рядка.
        </SheetDescription>
        <div className="mt-4 grid gap-3">
          <FormLabel title="Тип витрати">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={expenseScope === "OBJECT_DIRECT" ? "default" : "outline"}
                size="sm"
                onClick={() => setExpenseScope("OBJECT_DIRECT")}
              >
                Пряма на обʼєкт
              </Button>
              <Button
                type="button"
                variant={expenseScope === "GENERAL_CATEGORY" ? "default" : "outline"}
                size="sm"
                onClick={() => setExpenseScope("GENERAL_CATEGORY")}
              >
                Загальна по категорії
              </Button>
            </div>
          </FormLabel>
          {expenseScope === "GENERAL_CATEGORY" ? (
            <FormLabel title="Категорія загальних витрат">
              <select
                className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs"
                value={generalCategory}
                onChange={(e) => setGeneralCategory(e.target.value)}
              >
                <option>Офісні витрати</option>
                <option>Маркетинг</option>
                <option>Адміністративні</option>
                <option>Операційні</option>
                <option>Логістика (загальна)</option>
              </select>
            </FormLabel>
          ) : null}
          <FormLabel title="Проєкт">
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={expenseScope === "GENERAL_CATEGORY"}
            >
              {expenseScope === "GENERAL_CATEGORY" ? (
                <option value="">Без привʼязки до проєкту (загальна витрата)</option>
              ) : null}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </FormLabel>
          <FormLabel title="Категорія витрат">
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </FormLabel>
          <div className="grid grid-cols-3 gap-3">
            <FormLabel title="Кількість">
              <Input
                className="h-9 text-xs"
                type="number"
                min="0"
                step="0.001"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </FormLabel>
            <FormLabel title="Ціна за од.">
              <Input
                className="h-9 text-xs"
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(Number(e.target.value))}
              />
            </FormLabel>
            <FormLabel title="Сума">
              <Input className="h-9 text-xs" value={total.toFixed(2)} readOnly />
            </FormLabel>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormLabel title="Дата">
              <Input
                className="h-9 text-xs"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </FormLabel>
            <FormLabel title="Рахунок списання">
              <select
                className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </FormLabel>
          </div>
          <FormLabel title="Контрагент">
            <Input
              className="h-9 text-xs"
              placeholder="Постачальник / підрядник"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
            />
          </FormLabel>
          <FormLabel title="Номер документа">
            <Input
              className="h-9 text-xs"
              placeholder="EXP-2026-001"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
            />
          </FormLabel>
          <FormLabel title="Коментар">
            <Textarea
              className="min-h-[90px] text-xs"
              placeholder="Пояснення по витраті"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </FormLabel>
          <FormLabel title="Документ (PDF / Excel)">
            <Input
              className="h-9 text-xs"
              type="file"
              accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
            />
          </FormLabel>
          <div className="rounded-md border border-sky-200 bg-sky-50 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-sky-900">
                ШІ-розпізнавання документа (OCR + табличний парсинг)
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canRunAi}
                onClick={runAiRecognition}
              >
                {isAiAnalyzing ? "Розпізнаємо..." : "Розпізнати ШІ"}
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-sky-800">
              Підтримка: PDF, XLS, XLSX. Поля витрати будуть автозаповнені, ви можете відредагувати перед збереженням.
            </p>
            {sourceFile ? (
              <p className="mt-1 text-[11px] text-slate-700">Файл: {sourceFile.name}</p>
            ) : null}
            {aiNote ? <p className="mt-1 text-[11px] text-slate-800">{aiNote}</p> : null}
            {aiApplied ? (
              <p className="mt-1 text-[11px] font-medium text-emerald-700">
                ШІ заповнив поля форми. Перевірте та натисніть зберегти.
              </p>
            ) : null}
            {expenseScope === "GENERAL_CATEGORY" ? (
              <p className="mt-1 text-[11px] text-slate-700">
                Режим: загальна витрата. Запис буде з категорією "{generalCategory}" без прямої привʼязки до обʼєкта.
              </p>
            ) : null}
          </div>
          {aiLineItems.length > 0 ? (
            <div className="rounded-md border border-slate-200 bg-white p-2">
              <p className="mb-2 text-xs font-medium text-slate-800">Позиції, знайдені ШІ</p>
              <div className="max-h-40 overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="px-1 py-1 text-left">Позиція</th>
                      <th className="px-1 py-1 text-right">К-сть</th>
                      <th className="px-1 py-1 text-right">Ціна</th>
                      <th className="px-1 py-1 text-right">Сума</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiLineItems.map((li, idx) => (
                      <tr key={`${li.name}-${idx}`} className="border-t border-slate-100">
                        <td className="px-1 py-1 text-slate-700">{li.name}</td>
                        <td className="px-1 py-1 text-right text-slate-700">{li.qty}</td>
                        <td className="px-1 py-1 text-right text-slate-700">{li.unitCost.toFixed(2)}</td>
                        <td className="px-1 py-1 text-right text-slate-900">{li.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!aiApplied}
              onClick={() =>
                setAuditLog((prev) => [
                  {
                    at: new Date().toISOString(),
                    action: "Підтверджено автозаповнення ШІ перед збереженням",
                  },
                  ...prev,
                ])
              }
            >
              Підтвердити автозаповнення
            </Button>
            {aiApplied ? (
              <span className="text-[11px] text-emerald-700">Статус: підтвердження доступне</span>
            ) : null}
          </div>
          {auditLog.length > 0 ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
              <p className="mb-1 text-xs font-medium text-slate-800">Журнал дій</p>
              <ul className="space-y-1 text-[11px] text-slate-700">
                {auditLog.slice(0, 5).map((entry, idx) => (
                  <li key={`${entry.at}-${idx}`}>
                    {new Date(entry.at).toLocaleString("uk-UA")} - {entry.action}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {!canEdit ? (
            <p className="text-xs text-amber-700">
              У вашій ролі доступно створення запиту. Проведення витрати виконує бухгалтер.
            </p>
          ) : null}
          <Button disabled={total <= 0}>{canEdit ? "Зберегти витрату" : "Надіслати запит"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ExportModal({ projects }: { projects: SelectOption[] }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"CSV" | "XLSX">("CSV");

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Експорт
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-300 bg-white p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-900">Експорт фінансових даних</h3>
            <p className="mt-1 text-xs text-slate-500">Оберіть склад даних і формат файлу для вивантаження.</p>
            <div className="mt-4 grid gap-3">
              <FormLabel title="Проєкт">
                <select className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs">
                  <option value="ALL">Усі проєкти</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </FormLabel>
              <div className="grid grid-cols-2 gap-3">
                <FormLabel title="Початок періоду">
                  <Input className="h-9 text-xs" type="date" />
                </FormLabel>
                <FormLabel title="Кінець періоду">
                  <Input className="h-9 text-xs" type="date" />
                </FormLabel>
              </div>
              <FormLabel title="Формат">
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as "CSV" | "XLSX")}
                >
                  <option value="CSV">CSV</option>
                  <option value="XLSX">XLSX</option>
                </select>
              </FormLabel>
              <div className="rounded-md border border-slate-200 p-2 text-xs text-slate-600">
                До експорту увійдуть: транзакції, план оплат, підсумки прибутковості, борги клієнтів/постачальників.
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Скасувати
                </Button>
                <Button onClick={() => setOpen(false)}>Сформувати {format}</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

