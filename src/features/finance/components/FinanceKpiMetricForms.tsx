"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { putJson } from "@/lib/api/patch-json";
import type { FinanceExecutiveKpi } from "../lib/aggregation";
import type {
  ExecutiveKpiNoteRow,
  FinanceExecutiveKpiMetricId,
} from "../lib/executive-kpi-notes";

export type { FinanceExecutiveKpiMetricId as FinanceKpiMetricId } from "../lib/executive-kpi-notes";

const STORAGE_KEY = "enver-finance-kpi-form-drafts";

function money(v: number): string {
  return v.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function loadDraft(metric: FinanceExecutiveKpiMetricId): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const all = JSON.parse(raw) as Record<string, Record<string, string>>;
    return all[metric] ?? {};
  } catch {
    return {};
  }
}

function saveDraft(metric: FinanceExecutiveKpiMetricId, data: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const all = (raw ? JSON.parse(raw) : {}) as Record<string, Record<string, string>>;
    all[metric] = data;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

function mergePayload(metric: FinanceExecutiveKpiMetricId, noteRow?: ExecutiveKpiNoteRow | null): Record<string, string> {
  const local = loadDraft(metric);
  const server = noteRow?.payload ?? {};
  return { ...local, ...server };
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[11px] font-medium text-slate-600">{children}</span>;
}

type FormShellProps = {
  kpi: FinanceExecutiveKpi;
  initialPayload: Record<string, string>;
  onSave: (d: Record<string, string>) => void | Promise<void>;
  saving: boolean;
  error: string | null;
  okFlash: boolean;
  canEdit: boolean;
};

function SaveRow({
  saving,
  error,
  okFlash,
  canEdit,
}: {
  saving: boolean;
  error: string | null;
  okFlash: boolean;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-2 pt-1">
      {error ? <p className="text-[11px] leading-snug text-red-700">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={saving || !canEdit}>
          {saving ? "Збереження…" : "Зберегти в системі"}
        </Button>
        {okFlash ? <span className="text-[11px] font-medium text-emerald-700">Збережено в PostgreSQL</span> : null}
        {!canEdit ? (
          <span className="text-[11px] text-slate-500">
            Лише перегляд (потрібне право «Редагування уточнень KPI» / finance.kpi.notes.edit)
          </span>
        ) : null}
      </div>
      <p className="text-[10px] text-slate-400">
        Резервна копія в браузері при помилці мережі або 403. Основне сховище — база даних.
      </p>
    </div>
  );
}

function inputProps(disabled: boolean) {
  return disabled ? { disabled: true, className: "bg-slate-50 text-slate-700" } : {};
}

type PanelProps = {
  kpi: FinanceExecutiveKpi;
  metric: FinanceExecutiveKpiMetricId;
  noteRow?: ExecutiveKpiNoteRow | null;
  canEdit: boolean;
  onPersistSuccess: (row: ExecutiveKpiNoteRow) => void;
};

export function FinanceKpiMetricFormPanel({ kpi, metric, noteRow, canEdit, onPersistSuccess }: PanelProps) {
  const initialPayload = useMemo(() => mergePayload(metric, noteRow), [metric, noteRow]);
  const formKey = `${metric}-${noteRow?.updatedAt ?? "none"}`;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okFlash, setOkFlash] = useState(false);

  const persist = useCallback(
    async (data: Record<string, string>) => {
      if (!canEdit) return;
      setSaving(true);
      setError(null);
      try {
        const j = await putJson<ExecutiveKpiNoteRow & { error?: string }>(
          `/api/finance/executive-kpi-notes/${encodeURIComponent(metric)}`,
          { payload: data },
        );
        if (!j.metricId || !j.updatedAt) {
          throw new Error("Некоректна відповідь сервера");
        }
        saveDraft(metric, data);
        onPersistSuccess(j);
        setOkFlash(true);
        window.setTimeout(() => setOkFlash(false), 2800);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Помилка";
        try {
          saveDraft(metric, data);
          setError(`${msg} · Копія збережена локально в sessionStorage.`);
        } catch {
          setError(msg);
        }
      } finally {
        setSaving(false);
      }
    },
    [canEdit, metric, onPersistSuccess],
  );

  const shell: Omit<FormShellProps, "kpi" | "initialPayload"> = {
    onSave: persist,
    saving,
    error,
    okFlash,
    canEdit,
  };

  return (
    <div className="space-y-3">
      {noteRow ? (
        <p className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 text-[10px] leading-relaxed text-slate-600">
          Останнє оновлення:{" "}
          <time dateTime={noteRow.updatedAt} className="font-medium text-slate-800">
            {new Date(noteRow.updatedAt).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" })}
          </time>
          {noteRow.updatedByName ? (
            <>
              {" "}
              · <span className="text-slate-800">{noteRow.updatedByName}</span>
            </>
          ) : null}
        </p>
      ) : (
        <p className="text-[10px] text-slate-500">Ще немає збереженого запису в БД — поля можна заповнити та зберегти.</p>
      )}

      <div key={formKey}>
        {metric === "contractPortfolio" ? (
          <FormContractPortfolio kpi={kpi} initialPayload={initialPayload} {...shell} />
        ) : null}
        {metric === "receivedFromClients" ? (
          <FormReceivedFromClients kpi={kpi} initialPayload={initialPayload} {...shell} />
        ) : null}
        {metric === "receivables" ? <FormReceivables kpi={kpi} initialPayload={initialPayload} {...shell} /> : null}
        {metric === "payables" ? <FormPayables kpi={kpi} initialPayload={initialPayload} {...shell} /> : null}
        {metric === "cashOperatingExpenses" ? (
          <FormCashOperatingExpenses kpi={kpi} initialPayload={initialPayload} {...shell} />
        ) : null}
        {metric === "procurementPlanned" ? (
          <FormProcurementPlanned kpi={kpi} initialPayload={initialPayload} {...shell} />
        ) : null}
        {metric === "procurementAccrual" ? (
          <FormProcurementAccrual kpi={kpi} initialPayload={initialPayload} {...shell} />
        ) : null}
        {metric === "procurementCommitted" ? (
          <FormProcurementCommitted kpi={kpi} initialPayload={initialPayload} {...shell} />
        ) : null}
        {metric === "procurementReceivedValue" ? (
          <FormProcurementReceivedValue kpi={kpi} initialPayload={initialPayload} {...shell} />
        ) : null}
        {metric === "netProfitCash" ? <FormNetProfitCash kpi={kpi} initialPayload={initialPayload} {...shell} /> : null}
      </div>
    </div>
  );
}

export const FINANCE_KPI_SHEET_COPY: Record<
  FinanceExecutiveKpiMetricId,
  { title: string; subtitle: string }
> = {
  contractPortfolio: {
    title: "Портфель договорів",
    subtitle: "Сума договірних вартостей активних проєктів. Окремо від грошового руху.",
  },
  receivedFromClients: {
    title: "Отримано від клієнтів",
    subtitle: "Факт надходжень (cash) з модуля фінансів: тип INCOME.",
  },
  receivables: {
    title: "Дебіторка",
    subtitle: "Договірний портфель мінус отримано від клієнтів — очікувані оплати.",
  },
  payables: {
    title: "Кредиторка (PO)",
    subtitle: "Відкриті зобовʼязання перед постачальниками по PO (не PAID / не CANCELLED).",
  },
  cashOperatingExpenses: {
    title: "Грошові витрати (cash)",
    subtitle: "Витрати з модуля фінансів: EXPENSE, PAYROLL, COMMISSION (без дублювання закупівельних позицій).",
  },
  procurementPlanned: {
    title: "План закупівель (позиції)",
    subtitle: "Шар планування: сума plannedTotalCost по позиціях закупівель.",
  },
  procurementAccrual: {
    title: "Факт позицій (accrual)",
    subtitle: "Операційний облік номенклатури; не додається повторно до cash expense.",
  },
  procurementCommitted: {
    title: "Зобовʼязання PO",
    subtitle: "Шар комітменту: суми PO без чернеток і скасованих.",
  },
  procurementReceivedValue: {
    title: "Отримано по PO",
    subtitle: "receivedQty × ціна по рядках PO — факт поставки в грошах (не готівка).",
  },
  netProfitCash: {
    title: "Чистий прибуток (cash)",
    subtitle: "Валовий прибуток мінус зарплата та комісії в готівковому русі.",
  },
};

function FormContractPortfolio({ kpi, initialPayload, onSave, saving, error, okFlash, canEdit }: FormShellProps) {
  const dis = !canEdit;
  const [notes, setNotes] = useState(() => initialPayload.notes ?? "");
  const [reviewDate, setReviewDate] = useState(() => initialPayload.reviewDate ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ notes, reviewDate });
      }}
    >
      <p className="text-xs text-slate-600">
        Поточне значення: <strong className="text-[var(--enver-text)]">{money(kpi.contractPortfolio)} UAH</strong>
      </p>
      <div>
        <FieldLabel>Дата наступного перегляду портфелю</FieldLabel>
        <Input
          type="date"
          value={reviewDate}
          onChange={(e) => setReviewDate(e.target.value)}
          {...inputProps(dis)}
        />
      </div>
      <div>
        <FieldLabel>Примітки (ризики, зміни по проєктах)</FieldLabel>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Коротко для команди…"
          {...inputProps(dis)}
        />
      </div>
      <SaveRow saving={saving} error={error} okFlash={okFlash} canEdit={canEdit} />
    </form>
  );
}

function FormReceivedFromClients({ kpi, initialPayload, onSave, saving, error, okFlash, canEdit }: FormShellProps) {
  const dis = !canEdit;
  const [periodFrom, setPeriodFrom] = useState(() => initialPayload.periodFrom ?? "");
  const [periodTo, setPeriodTo] = useState(() => initialPayload.periodTo ?? "");
  const [notes, setNotes] = useState(() => initialPayload.notes ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ periodFrom, periodTo, notes });
      }}
    >
      <p className="text-xs text-slate-600">
        Поточне значення: <strong className="text-[var(--enver-text)]">{money(kpi.receivedFromClients)} UAH</strong>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Період звіту від</FieldLabel>
          <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} {...inputProps(dis)} />
        </div>
        <div>
          <FieldLabel>Період до</FieldLabel>
          <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} {...inputProps(dis)} />
        </div>
      </div>
      <div>
        <FieldLabel>Коментар (узгодження з банком / касою)</FieldLabel>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} {...inputProps(dis)} />
      </div>
      <SaveRow saving={saving} error={error} okFlash={okFlash} canEdit={canEdit} />
    </form>
  );
}

function FormReceivables({ kpi, initialPayload, onSave, saving, error, okFlash, canEdit }: FormShellProps) {
  const dis = !canEdit;
  const [nextReminder, setNextReminder] = useState(() => initialPayload.nextReminder ?? "");
  const [owner, setOwner] = useState(() => initialPayload.owner ?? "");
  const [notes, setNotes] = useState(() => initialPayload.notes ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ nextReminder, owner, notes });
      }}
    >
      <p className="text-xs text-slate-600">
        Поточне значення: <strong className="text-[var(--enver-text)]">{money(kpi.receivables)} UAH</strong>
      </p>
      <div>
        <FieldLabel>Наступне нагадування клієнту</FieldLabel>
        <Input
          type="date"
          value={nextReminder}
          onChange={(e) => setNextReminder(e.target.value)}
          {...inputProps(dis)}
        />
      </div>
      <div>
        <FieldLabel>Відповідальний менеджер</FieldLabel>
        <Input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="ПІБ або роль"
          {...inputProps(dis)}
        />
      </div>
      <div>
        <FieldLabel>План погашення / коментар</FieldLabel>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} {...inputProps(dis)} />
      </div>
      <SaveRow saving={saving} error={error} okFlash={okFlash} canEdit={canEdit} />
    </form>
  );
}

function FormPayables({ kpi, initialPayload, onSave, saving, error, okFlash, canEdit }: FormShellProps) {
  const dis = !canEdit;
  const [priority, setPriority] = useState(() => initialPayload.priority ?? "medium");
  const [notes, setNotes] = useState(() => initialPayload.notes ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ priority, notes });
      }}
    >
      <p className="text-xs text-slate-600">
        Поточне значення: <strong className="text-[var(--enver-text)]">{money(kpi.payables)} UAH</strong>
      </p>
      <p className="text-[11px] text-slate-500">
        Деталі по PO доступні у відповідному пункті бокового меню.
      </p>
      <div>
        <FieldLabel>Пріоритет оплат постачальникам</FieldLabel>
        <select
          className="flex h-9 w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-3 text-sm disabled:bg-slate-50"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          disabled={dis}
        >
          <option value="high">Високий</option>
          <option value="medium">Середній</option>
          <option value="low">Низький</option>
        </select>
      </div>
      <div>
        <FieldLabel>Примітки (критичні PO, умови)</FieldLabel>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} {...inputProps(dis)} />
      </div>
      <SaveRow saving={saving} error={error} okFlash={okFlash} canEdit={canEdit} />
    </form>
  );
}

function FormCashOperatingExpenses({ kpi, initialPayload, onSave, saving, error, okFlash, canEdit }: FormShellProps) {
  const dis = !canEdit;
  const [focusCategory, setFocusCategory] = useState(() => initialPayload.focusCategory ?? "");
  const [notes, setNotes] = useState(() => initialPayload.notes ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ focusCategory, notes });
      }}
    >
      <p className="text-xs text-slate-600">
        Поточне значення: <strong className="text-[var(--enver-text)]">{money(kpi.cashOperatingExpenses)} UAH</strong>
      </p>
      <div>
        <FieldLabel>Стаття для уточнення / розбору</FieldLabel>
        <Input
          value={focusCategory}
          onChange={(e) => setFocusCategory(e.target.value)}
          placeholder="Напр. матеріали, логістика…"
          {...inputProps(dis)}
        />
      </div>
      <div>
        <FieldLabel>Коментар до звіту витрат</FieldLabel>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} {...inputProps(dis)} />
      </div>
      <SaveRow saving={saving} error={error} okFlash={okFlash} canEdit={canEdit} />
    </form>
  );
}

function FormProcurementPlanned({ kpi, initialPayload, onSave, saving, error, okFlash, canEdit }: FormShellProps) {
  const dis = !canEdit;
  const [targetAdjust, setTargetAdjust] = useState(() => initialPayload.targetAdjust ?? "");
  const [notes, setNotes] = useState(() => initialPayload.notes ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ targetAdjust, notes });
      }}
    >
      <p className="text-xs text-slate-600">
        Поточне значення: <strong className="text-[var(--enver-text)]">{money(kpi.procurementPlanned)} UAH</strong>
      </p>
      <div>
        <FieldLabel>Коригування цілі плану (опційно, UAH)</FieldLabel>
        <Input
          inputMode="decimal"
          value={targetAdjust}
          onChange={(e) => setTargetAdjust(e.target.value)}
          placeholder="0,00"
          {...inputProps(dis)}
        />
      </div>
      <div>
        <FieldLabel>Обґрунтування зміни плану</FieldLabel>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} {...inputProps(dis)} />
      </div>
      <SaveRow saving={saving} error={error} okFlash={okFlash} canEdit={canEdit} />
    </form>
  );
}

function FormProcurementAccrual({ kpi, initialPayload, onSave, saving, error, okFlash, canEdit }: FormShellProps) {
  const dis = !canEdit;
  const variance = kpi.procurementAccrual - kpi.procurementPlanned;
  const [notes, setNotes] = useState(() => initialPayload.notes ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ notes });
      }}
    >
      <p className="text-xs text-slate-600">
        Факт: <strong>{money(kpi.procurementAccrual)} UAH</strong> · План:{" "}
        <strong>{money(kpi.procurementPlanned)} UAH</strong>
      </p>
      <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700">
        Відхилення (факт − план): <strong>{money(variance)} UAH</strong>
      </p>
      <div>
        <FieldLabel>Коментар по accrual (номенклатура)</FieldLabel>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} {...inputProps(dis)} />
      </div>
      <SaveRow saving={saving} error={error} okFlash={okFlash} canEdit={canEdit} />
    </form>
  );
}

function FormProcurementCommitted({ kpi, initialPayload, onSave, saving, error, okFlash, canEdit }: FormShellProps) {
  const dis = !canEdit;
  const [reviewDeadline, setReviewDeadline] = useState(() => initialPayload.reviewDeadline ?? "");
  const [notes, setNotes] = useState(() => initialPayload.notes ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ reviewDeadline, notes });
      }}
    >
      <p className="text-xs text-slate-600">
        Поточне значення: <strong className="text-[var(--enver-text)]">{money(kpi.procurementCommitted)} UAH</strong>
      </p>
      <div>
        <FieldLabel>Дедлайн перевірки відкритих PO</FieldLabel>
        <Input
          type="date"
          value={reviewDeadline}
          onChange={(e) => setReviewDeadline(e.target.value)}
          {...inputProps(dis)}
        />
      </div>
      <div>
        <FieldLabel>Примітки (затвердження, зміни умов)</FieldLabel>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} {...inputProps(dis)} />
      </div>
      <SaveRow saving={saving} error={error} okFlash={okFlash} canEdit={canEdit} />
    </form>
  );
}

function FormProcurementReceivedValue({ kpi, initialPayload, onSave, saving, error, okFlash, canEdit }: FormShellProps) {
  const dis = !canEdit;
  const [controlAmount, setControlAmount] = useState(() => initialPayload.controlAmount ?? "");
  const [notes, setNotes] = useState(() => initialPayload.notes ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ controlAmount, notes });
      }}
    >
      <p className="text-xs text-slate-600">
        Поточне значення: <strong className="text-[var(--enver-text)]">{money(kpi.procurementReceivedValue)} UAH</strong>
      </p>
      <div>
        <FieldLabel>Контрольна сума (з актів / накладних)</FieldLabel>
        <Input
          inputMode="decimal"
          value={controlAmount}
          onChange={(e) => setControlAmount(e.target.value)}
          placeholder="Порівняти з системою…"
          {...inputProps(dis)}
        />
      </div>
      <div>
        <FieldLabel>Коментар по поставках</FieldLabel>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} {...inputProps(dis)} />
      </div>
      <SaveRow saving={saving} error={error} okFlash={okFlash} canEdit={canEdit} />
    </form>
  );
}

function FormNetProfitCash({ kpi, initialPayload, onSave, saving, error, okFlash, canEdit }: FormShellProps) {
  const dis = !canEdit;
  const [targetMarginPct, setTargetMarginPct] = useState(() => initialPayload.targetMarginPct ?? "");
  const [notes, setNotes] = useState(() => initialPayload.notes ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ targetMarginPct, notes });
      }}
    >
      <p className="text-xs text-slate-600">
        Поточне значення: <strong className="text-[var(--enver-text)]">{money(kpi.netProfitCash)} UAH</strong>
      </p>
      <p className="text-[11px] text-slate-500">
        Валовий прибуток (cash): {money(kpi.grossProfitCash)} · ЗП (облік): {money(kpi.payrollTotal)} · Комісії
        (облік): {money(kpi.commissionTotal)}
      </p>
      <div>
        <FieldLabel>Цільова маржа, % (для орієнтиру)</FieldLabel>
        <Input
          inputMode="decimal"
          value={targetMarginPct}
          onChange={(e) => setTargetMarginPct(e.target.value)}
          placeholder="Напр. 18"
          {...inputProps(dis)}
        />
      </div>
      <div>
        <FieldLabel>Висновки / заходи</FieldLabel>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} {...inputProps(dis)} />
      </div>
      <SaveRow saving={saving} error={error} okFlash={okFlash} canEdit={canEdit} />
    </form>
  );
}
