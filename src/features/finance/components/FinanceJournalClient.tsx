"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoneyUa } from "@/features/finance/lib/format-money";

type LedgerAccount = {
  id: string;
  code: string;
  name: string;
  kind: string;
};

const KIND_UA: Record<string, string> = {
  ASSET: "Активи",
  LIABILITY: "Зобовʼязання",
  EQUITY: "Капітал",
  REVENUE: "Доходи",
  EXPENSE: "Витрати",
  OTHER: "Інші",
};

type JournalLineOut = {
  id: string;
  ledgerAccountId: string;
  accountCode: string;
  accountName: string;
  debitAmount: string;
  creditAmount: string;
  lineMemo: string | null;
};

type JournalEntryOut = {
  id: string;
  dealId: string | null;
  deal: { id: string; title: string } | null;
  postedAt: string;
  status: string;
  memo: string | null;
  createdBy: { id: string; name: string | null; email: string | null } | null;
  lines: JournalLineOut[];
};

type LineDraft = { ledgerAccountId: string; debitAmount: string; creditAmount: string; lineMemo: string };

type DealOption = { id: string; title: string; value: string | null };

function parseAmount(s: string): number {
  const t = String(s).trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function defaultLines(): LineDraft[] {
  return [
    { ledgerAccountId: "", debitAmount: "", creditAmount: "0", lineMemo: "" },
    { ledgerAccountId: "", debitAmount: "0", creditAmount: "", lineMemo: "" },
  ];
}

export function FinanceJournalClient() {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [dealOptions, setDealOptions] = useState<DealOption[]>([]);
  const [entries, setEntries] = useState<JournalEntryOut[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [memo, setMemo] = useState("");
  const [postedAt, setPostedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [status, setStatus] = useState<"DRAFT" | "POSTED">("POSTED");
  const [dealId, setDealId] = useState("");
  const [lines, setLines] = useState<LineDraft[]>(defaultLines);

  const [listFilterDealId, setListFilterDealId] = useState("");

  const accountsByKind = useMemo(() => {
    const m = new Map<string, LedgerAccount[]>();
    for (const a of accounts) {
      const k = a.kind || "OTHER";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return m;
  }, [accounts]);

  const { totalDebit, totalCredit, balanced, lineProblems } = useMemo(() => {
    let d = 0;
    let c = 0;
    const problems: string[] = [];
    for (const line of lines) {
      if (!line.ledgerAccountId) continue;
      const dv = parseAmount(line.debitAmount);
      const cv = parseAmount(line.creditAmount);
      if (dv > 0 && cv > 0) {
        problems.push("У рядку не може бути одночасно дебет і кредит");
      }
      d += dv;
      c += cv;
    }
    const diff = Math.abs(d - c);
    const balanced = diff < 0.005 && d > 0;
    return { totalDebit: d, totalCredit: c, balanced, lineProblems: problems };
  }, [lines]);

  const filledLines = useMemo(
    () => lines.filter((l) => l.ledgerAccountId.trim() !== ""),
    [lines],
  );

  const canSubmit =
    filledLines.length >= 2 &&
    balanced &&
    lineProblems.length === 0 &&
    !saving;

  const loadAccountsAndDeals = useCallback(async () => {
    const [a, d] = await Promise.all([
      fetch("/api/crm/finance/ledger-accounts"),
      fetch("/api/crm/finance/deal-options"),
    ]);
    const aj = (await a.json()) as { accounts?: LedgerAccount[]; error?: string };
    const dj = (await d.json()) as { deals?: DealOption[]; error?: string };
    if (!a.ok) throw new Error(aj.error ?? "ledger-accounts");
    if (!d.ok) throw new Error(dj.error ?? "deal-options");
    setAccounts(aj.accounts ?? []);
    setDealOptions(dj.deals ?? []);
  }, []);

  const loadEntries = useCallback(
    async (dealFilter: string, opts?: { cursor?: string | null; append?: boolean }) => {
      const q = new URLSearchParams({ take: "20" });
      if (dealFilter.trim()) q.set("dealId", dealFilter.trim());
      if (opts?.cursor?.trim()) q.set("cursor", opts.cursor.trim());
      const e = await fetch(`/api/crm/finance/journal-entries?${q}`);
      const ej = (await e.json()) as {
        entries?: JournalEntryOut[];
        nextCursor?: string | null;
        error?: string;
      };
      if (!e.ok) throw new Error(ej.error ?? "journal-entries");
      const list = ej.entries ?? [];
      const nc = ej.nextCursor ?? null;
      if (opts?.append) {
        setEntries((prev) => [...prev, ...list]);
      } else {
        setEntries(list);
      }
      setNextCursor(nc);
    },
    [],
  );

  /** Первинне завантаження рахунків і угод. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setErr(null);
      setLoading(true);
      try {
        await loadAccountsAndDeals();
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Помилка завантаження");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAccountsAndDeals]);

  /** Список проводок після готовності даних або зміни фільтра угоди. */
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    void (async () => {
      setListLoading(true);
      setErr(null);
      try {
        await loadEntries(listFilterDealId);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Помилка списку");
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listFilterDealId, loading, loadEntries]);

  const refreshAll = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      await loadAccountsAndDeals();
      await loadEntries(listFilterDealId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка оновлення");
    } finally {
      setLoading(false);
    }
  }, [loadAccountsAndDeals, loadEntries, listFilterDealId]);

  function addLine() {
    setLines((prev) => [...prev, { ledgerAccountId: "", debitAmount: "", creditAmount: "", lineMemo: "" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, j) => j !== i)));
  }

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  async function loadMore() {
    if (!nextCursor || loadingMore || listLoading) return;
    setLoadingMore(true);
    setErr(null);
    try {
      await loadEntries(listFilterDealId, { cursor: nextCursor, append: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка завантаження");
    } finally {
      setLoadingMore(false);
    }
  }

  async function voidEntry(entryId: string) {
    if (!confirm("Скасувати проведення цієї проводки? Статус зміниться на VOIDED.")) return;
    setVoidingId(entryId);
    setErr(null);
    try {
      const r = await fetch(`/api/crm/finance/journal-entries/${encodeURIComponent(entryId)}/void`, {
        method: "POST",
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Не вдалося скасувати");
      await loadEntries(listFilterDealId, { append: false });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setVoidingId(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        memo: memo.trim() || null,
        postedAt: new Date(postedAt).toISOString(),
        status,
        dealId: dealId.trim() || null,
        lines: filledLines.map((l) => ({
          ledgerAccountId: l.ledgerAccountId,
          debitAmount: parseAmount(l.debitAmount),
          creditAmount: parseAmount(l.creditAmount),
          lineMemo: l.lineMemo.trim() || null,
        })),
      };
      const r = await fetch("/api/crm/finance/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Не вдалося зберегти");
      setMemo("");
      setDealId("");
      setLines(defaultLines());
      await loadEntries(listFilterDealId, { append: false });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Помилка");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-36 rounded-2xl bg-slate-100" />
        <div className="h-48 rounded-xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {err ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{err}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Нова проводка</h2>
        <p className="mt-1 text-xs text-slate-600">
          У кожному рядку заповніть лише дебет або лише кредит. Сума дебетів має дорівнювати сумі кредитів.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">
              Дата проведення
              <Input
                type="datetime-local"
                value={postedAt}
                onChange={(e) => setPostedAt(e.target.value)}
                className="mt-1"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Статус
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "DRAFT" | "POSTED")}
                className="mt-1 flex h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
              >
                <option value="POSTED">Проведено (POSTED)</option>
                <option value="DRAFT">Чернетка (DRAFT)</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600 sm:col-span-2">
              Угода (опційно)
              <select
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
              >
                <option value="">— без привʼязки до угоди —</option>
                {dealOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title.slice(0, 72)}
                    {d.title.length > 72 ? "…" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-600">
            Коментар
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} className="mt-1" placeholder="Напр.: оплата клієнта" />
          </label>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs">
            <span className="text-slate-600">
              Дебет: <strong className="tabular-nums text-slate-900">{formatMoneyUa(totalDebit)}</strong>
            </span>
            <span className="text-slate-600">
              Кредит: <strong className="tabular-nums text-slate-900">{formatMoneyUa(totalCredit)}</strong>
            </span>
            <span
              className={
                balanced && totalDebit > 0
                  ? "font-medium text-emerald-700"
                  : filledLines.length >= 2
                    ? "font-medium text-amber-700"
                    : "text-slate-500"
              }
            >
              {filledLines.length < 2
                ? "Додайте щонайменше 2 рядки з рахунками"
                : balanced && totalDebit > 0
                  ? "Баланс збігається ✓"
                  : `Різниця: ${formatMoneyUa(Math.abs(totalDebit - totalCredit))} грн`}
            </span>
          </div>
          {lineProblems.length > 0 ? (
            <p className="text-xs text-rose-700">{lineProblems[0]}</p>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2">Рахунок</th>
                  <th className="px-2 py-2 w-28">Дебет</th>
                  <th className="px-2 py-2 w-28">Кредит</th>
                  <th className="px-2 py-2 min-w-[140px]">Примітка</th>
                  <th className="w-10" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-2">
                      <select
                        value={line.ledgerAccountId}
                        onChange={(e) => updateLine(i, { ledgerAccountId: e.target.value })}
                        className="w-full min-w-[260px] max-w-[min(100vw-2rem,520px)] rounded border border-slate-200 px-2 py-1.5 text-xs"
                      >
                        <option value="">— оберіть рахунок —</option>
                        {[...accountsByKind.entries()]
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([kind, items]) => (
                            <optgroup key={kind} label={KIND_UA[kind] ?? kind}>
                              {items.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.code} · {a.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        inputMode="decimal"
                        value={line.debitAmount}
                        onChange={(e) => updateLine(i, { debitAmount: e.target.value })}
                        className="h-8 font-mono text-xs"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        inputMode="decimal"
                        value={line.creditAmount}
                        onChange={(e) => updateLine(i, { creditAmount: e.target.value })}
                        className="h-8 font-mono text-xs"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={line.lineMemo}
                        onChange={(e) => updateLine(i, { lineMemo: e.target.value })}
                        className="h-8 text-xs"
                        placeholder="опційно"
                      />
                    </td>
                    <td className="px-1 py-2">
                      {lines.length > 2 ? (
                        <button
                          type="button"
                          className="text-xs text-rose-600 hover:underline"
                          onClick={() => removeLine(i)}
                        >
                          ×
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              + Рядок
            </Button>
            <Button type="submit" disabled={!canSubmit} size="sm">
              {saving ? "Збереження…" : "Зберегти проводку"}
            </Button>
            {!canSubmit && !saving ? (
              <span className="text-xs text-slate-500">Увімкніть кнопку, коли дебет = кредит і є ≥2 рядки з рахунками</span>
            ) : null}
          </div>
        </form>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Останні проводки</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              Фільтр угоди
              <select
                value={listFilterDealId}
                onChange={(e) => setListFilterDealId(e.target.value)}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs max-w-[min(100vw-8rem,280px)]"
              >
                <option value="">Усі</option>
                {dealOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title.slice(0, 48)}
                    {d.title.length > 48 ? "…" : ""}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="outline" size="sm" onClick={() => void refreshAll()} disabled={listLoading || loading}>
              {listLoading || loading ? "Оновлення…" : "Оновити"}
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          {entries.length === 0 && !listLoading ? (
            <p className="text-sm text-slate-500">Проводок ще немає.</p>
          ) : null}
          {entries.map((en) => {
              const entryTotal = en.lines.reduce((s, l) => s + Number(l.debitAmount), 0);
              return (
                <div
                  key={en.id}
                  className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/90 p-3 text-sm shadow-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          en.status === "POSTED"
                            ? "bg-emerald-100 text-emerald-900"
                            : en.status === "VOIDED"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {en.status}
                      </span>
                      {en.status === "POSTED" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          disabled={voidingId === en.id}
                          onClick={() => void voidEntry(en.id)}
                        >
                          {voidingId === en.id ? "Скасування…" : "Скасувати проведення"}
                        </Button>
                      ) : null}
                      <span className="text-xs text-slate-600">
                        {new Date(en.postedAt).toLocaleString("uk-UA")}
                      </span>
                      {entryTotal > 0 ? (
                        <span className="text-xs font-medium text-slate-700">

                          {formatMoneyUa(entryTotal)} грн

                        </span>

                      ) : null}

                    </div>

                    {en.createdBy?.name || en.createdBy?.email ? (

                      <span className="text-[11px] text-slate-500">

                        {en.createdBy?.name ?? en.createdBy?.email}

                      </span>

                    ) : null}

                  </div>

                  {en.memo ? <p className="mt-1.5 text-slate-800">{en.memo}</p> : null}

                  {en.deal ? (

                    <p className="mt-1 text-xs">

                      <Link

                        href={`/deals/${en.deal.id}/workspace`}

                        className="font-medium text-blue-700 underline-offset-2 hover:underline"

                      >

                        {en.deal.title}

                      </Link>

                    </p>

                  ) : null}

                  <table className="mt-2 w-full text-xs">

                    <thead>

                      <tr className="text-left text-[10px] uppercase text-slate-400">

                        <th className="pb-1 font-normal">Рахунок</th>

                        <th className="pb-1 text-right font-normal">Дебет</th>

                        <th className="pb-1 text-right font-normal">Кредит</th>

                      </tr>

                    </thead>

                    <tbody>

                      {en.lines.map((l) => (

                        <tr key={l.id} className="border-t border-slate-200/80">

                          <td className="py-1 pr-2">

                            <span className="font-mono text-slate-600">{l.accountCode}</span> {l.accountName}

                          </td>

                          <td className="py-1 text-right tabular-nums text-emerald-800">

                            {Number(l.debitAmount) > 0 ? formatMoneyUa(Number(l.debitAmount)) : "—"}

                          </td>

                          <td className="py-1 text-right tabular-nums text-rose-800">

                            {Number(l.creditAmount) > 0 ? formatMoneyUa(Number(l.creditAmount)) : "—"}

                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              );

            })}

          {nextCursor ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingMore || listLoading}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "Завантаження…" : "Завантажити ще"}
              </Button>
            </div>
          ) : null}

        </div>

      </section>

    </div>

  );

}
